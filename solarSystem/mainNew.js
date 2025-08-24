
        // =========================================================================
        // CONSTANTES E CONFIGURAÇÕES
        // =========================================================================

        // Dados básicos dos planetas (rotação e cor)
        const planetData = {
            mercury: { rotationSpeed: 0.0010, color: [0.7, 0.7, 0.7, 1] },
            venus:   { rotationSpeed: 0.0008, color: [0.9, 0.6, 0.2, 1] },
            earth:   { rotationSpeed: 0.0500, color: [0.2, 0.2, 0.8, 1] },
            mars:    { rotationSpeed: 0.0450, color: [0.8, 0.3, 0.1, 1] },
            jupiter: { rotationSpeed: 0.1200, color: [0.8, 0.7, 0.5, 1] },
            saturn:  { rotationSpeed: 0.1100, color: [0.9, 0.8, 0.6, 1] },
            uranus:  { rotationSpeed: 0.0800, color: [0.6, 0.8, 0.9, 1] },
            neptune: { rotationSpeed: 0.0750, color: [0.3, 0.5, 0.9, 1] }
        };

        // =========================================================================
        // CLASSES
        // =========================================================================

        var Node = function() {
            this.children = [];
            this.localMatrix = m4.identity();
            this.worldMatrix = m4.identity();
            this.drawInfo = null;
            this.parent = null;
        };

        Node.prototype.setParent = function(parent) {
            if (this.parent) {
                var ndx = this.parent.children.indexOf(this);
                if (ndx >= 0) {
                    this.parent.children.splice(ndx, 1);
                }
            }
            if (parent) {
                parent.children.push(this);
            }
            this.parent = parent;
        };

        Node.prototype.updateWorldMatrix = function(parentWorldMatrix) {
            if (parentWorldMatrix) {
                m4.multiply(parentWorldMatrix, this.localMatrix, this.worldMatrix);
            } else {
                m4.copy(this.localMatrix, this.worldMatrix);
            }
            var worldMatrix = this.worldMatrix;
            this.children.forEach(function(child) {
                child.updateWorldMatrix(worldMatrix);
            });
        };

        // =========================================================================
        // FUNÇÕES UTILITÁRIAS (PARSERS, INTERPOLAÇÃO, ETC.)
        // =========================================================================

        function parseOBJ(text) {
            const objPositions = [[0, 0, 0]];
            const objTexcoords = [[0, 0]];
            const objNormals = [[0, 0, 0]];
            const objColors = [[0, 0, 0]];
            const objVertexData = [objPositions, objTexcoords, objNormals, objColors];
            let webglVertexData = [[], [], [], []];
            const materialLibs = [];
            const geometries = [];
            let geometry;
            let groups = ['default'];
            let material = 'default';
            let object = 'default';
            const noop = () => {};
            function newGeometry() {
                if (geometry && geometry.data.position.length) {
                    geometry = undefined;
                }
            }
            function setGeometry() {
                if (!geometry) {
                    const position = [];
                    const texcoord = [];
                    const normal = [];
                    const color = [];
                    webglVertexData = [position, texcoord, normal, color];
                    geometry = {
                        object,
                        groups,
                        material,
                        data: { position, texcoord, normal, color },
                    };
                    geometries.push(geometry);
                }
            }
            function addVertex(vert) {
                const ptn = vert.split('/');
                ptn.forEach((objIndexStr, i) => {
                    if (!objIndexStr) return;
                    const objIndex = parseInt(objIndexStr);
                    const index = objIndex + (objIndex >= 0 ? 0 : objVertexData[i].length);
                    webglVertexData[i].push(...objVertexData[i][index]);
                    if (i === 0 && objColors.length > 1) {
                        geometry.data.color.push(...objColors[index]);
                    }
                });
            }
            const keywords = {
                v(parts) {
                    if (parts.length > 3) {
                        objPositions.push(parts.slice(0, 3).map(parseFloat));
                        objColors.push(parts.slice(3).map(parseFloat));
                    } else {
                        objPositions.push(parts.map(parseFloat));
                    }
                },
                vn(parts) { objNormals.push(parts.map(parseFloat)); },
                vt(parts) { objTexcoords.push(parts.map(parseFloat)); },
                f(parts) {
                    setGeometry();
                    const numTriangles = parts.length - 2;
                    for (let tri = 0; tri < numTriangles; ++tri) {
                        addVertex(parts[0]);
                        addVertex(parts[tri + 1]);
                        addVertex(parts[tri + 2]);
                    }
                },
                s: noop,
                mtllib(parts) { materialLibs.push(parts.join(' ')); },
                usemtl(parts, unparsedArgs) {
                    material = unparsedArgs;
                    newGeometry();
                },
                g(parts) {
                    groups = parts;
                    newGeometry();
                },
                o(parts, unparsedArgs) {
                    object = unparsedArgs;
                    newGeometry();
                },
            };
            const keywordRE = /(\w*)(?: )*(.*)/;
            const lines = text.split('\n');
            for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
                const line = lines[lineNo].trim();
                if (line === '' || line.startsWith('#')) continue;
                const m = keywordRE.exec(line);
                if (!m) continue;
                const [, keyword, unparsedArgs] = m;
                const parts = line.split(/\s+/).slice(1);
                const handler = keywords[keyword];
                if (!handler) {
                    console.warn('unhandled keyword:', keyword);
                    continue;
                }
                handler(parts, unparsedArgs);
            }
            for (const geometry of geometries) {
                geometry.data = Object.fromEntries(
                    Object.entries(geometry.data).filter(([, array]) => array.length > 0));
            }
            return { geometries, materialLibs };
        }

        function parseMTL(text) {
            const materials = {};
            let material;
            const keywords = {
                newmtl(parts, unparsedArgs) {
                    material = {};
                    materials[unparsedArgs] = material;
                },
                Ns(parts) { material.shininess = parseFloat(parts[0]); },
                Ka(parts) { material.ambient = parts.map(parseFloat); },
                Kd(parts) { material.diffuse = parts.map(parseFloat); },
                Ks(parts) { material.specular = parts.map(parseFloat); },
                Ke(parts) { material.emissive = parts.map(parseFloat); },
                map_Kd(parts, unparsedArgs) { material.diffuseMap = unparsedArgs; },
                map_Ns(parts, unparsedArgs) { material.specularMap = unparsedArgs; },
                map_Bump(parts, unparsedArgs) { material.normalMap = unparsedArgs; },
                Ni(parts) { material.opticalDensity = parseFloat(parts[0]); },
                d(parts) { material.opacity = parseFloat(parts[0]); },
                illum(parts) { material.illum = parseInt(parts[0]); },
            };
            const keywordRE = /(\w*)(?: )*(.*)/;
            const lines = text.split('\n');
            for (let lineNo = 0; lineNo < lines.length; ++lineNo) {
                const line = lines[lineNo].trim();
                if (line === '' || line.startsWith('#')) continue;
                const m = keywordRE.exec(line);
                if (!m) continue;
                const [, keyword, unparsedArgs] = m;
                const parts = line.split(/\s+/).slice(1);
                const handler = keywords[keyword];
                if (!handler) {
                    console.warn('unhandled keyword:', keyword);
                    continue;
                }
                handler(parts, unparsedArgs);
            }
            return materials;
        }

        function generateTangents(position, texcoord, indices) {
            const makeIndexIterator = (indices) => {
                let ndx = 0;
                const fn = () => indices[ndx++];
                fn.reset = () => { ndx = 0; };
                fn.numElements = indices.length;
                return fn;
            };
            const makeUnindexedIterator = (positions) => {
                let ndx = 0;
                const fn = () => ndx++;
                fn.reset = () => { ndx = 0; };
                fn.numElements = positions.length / 3;
                return fn;
            };
            const subtractVector2 = (a, b) => a.map((v, ndx) => v - b[ndx]);

            const getNextIndex = indices ? makeIndexIterator(indices) : makeUnindexedIterator(position);
            const numFaceVerts = getNextIndex.numElements;
            const numFaces = numFaceVerts / 3;
            const tangents = [];
            for (let i = 0; i < numFaces; ++i) {
                const n1 = getNextIndex();
                const n2 = getNextIndex();
                const n3 = getNextIndex();
                const p1 = position.slice(n1 * 3, n1 * 3 + 3);
                const p2 = position.slice(n2 * 3, n2 * 3 + 3);
                const p3 = position.slice(n3 * 3, n3 * 3 + 3);
                const uv1 = texcoord.slice(n1 * 2, n1 * 2 + 2);
                const uv2 = texcoord.slice(n2 * 2, n2 * 2 + 2);
                const uv3 = texcoord.slice(n3 * 2, n3 * 2 + 2);
                const dp12 = m4.subtractVectors(p2, p1);
                const dp13 = m4.subtractVectors(p3, p1);
                const duv12 = subtractVector2(uv2, uv1);
                const duv13 = subtractVector2(uv3, uv1);
                const f = 1.0 / (duv12[0] * duv13[1] - duv13[0] * duv12[1]);
                const tangent = Number.isFinite(f)
                    ? m4.normalize(m4.scaleVector(m4.subtractVectors(
                        m4.scaleVector(dp12, duv13[1]),
                        m4.scaleVector(dp13, duv12[1]),
                    ), f))
                    : [1, 0, 0];
                tangents.push(...tangent, ...tangent, ...tangent);
            }
            return tangents;
        }

        /**
         * Carrega dados orbitais de um arquivo de texto no formato NASA.
         */
        function parseNASAOrbitalData(text) {
            const lines = text.trim().split('\n');
            const points = [];
            const startDate = new Date(1990, 0, 1); // 1 de Janeiro de 1990
            
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 6) continue;
                
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const day = parseInt(parts[2]);
                const x = parseFloat(parts[3]);
                const y = parseFloat(parts[4]);
                const z = parseFloat(parts[5]);
                
                // Calcular dias desde a data de referência
                const currentDate = new Date(year, month - 1, day);
                const time = (currentDate - startDate) / (1000 * 60 * 60 * 24);
                
                points.push({ time, position: [x, y, z] });
            }
            
            return points;
        }

        /**
         * Interpolação Catmull-Rom para suavização de trajetórias
         */
        function catmullRom(p0, p1, p2, p3, t) {
            const t2 = t * t;
            const t3 = t2 * t;
            
            return [
                0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + 
                    (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + 
                    (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + 
                    (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + 
                    (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
                0.5 * ((2 * p1[2]) + (-p0[2] + p2[2]) * t + 
                    (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t2 + 
                    (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * t3)
            ];
        }

        /**
         * Obtém posição interpolada dos dados orbitais
         */
        function getInterpolatedPosition(points, time) {
            if (points.length < 4) return [0, 0, 0];
            
            // Encontrar segmento de tempo apropriado
            let index = 1;
            for (; index < points.length - 2; index++) {
                if (time <= points[index].time) break;
            }
            
            const p0 = points[Math.max(0, index - 1)].position;
            const p1 = points[index].position;
            const p2 = points[index + 1].position;
            const p3 = points[Math.min(points.length - 1, index + 2)].position;
            
            // Calcular fator de interpolação (0-1) entre p1 e p2
            const segmentTime = points[index + 1].time - points[index].time;
            const t = segmentTime > 0 ? (time - points[index].time) / segmentTime : 0;
            
            return catmullRom(p0, p1, p2, p3, t);
        }

        // =========================================================================
        // FUNÇÃO PRINCIPAL
        // =========================================================================

        async function main() {
            // Ocultar tela de carregamento quando tudo estiver pronto
            const loadingScreen = document.getElementById('loading');
            
            // --- INICIALIZAÇÃO DO WEBGL ---
            const canvas = document.querySelector("#canvas");
            const gl = canvas.getContext("webgl2");
            if (!gl) {
                alert("Seu navegador não suporta WebGL2. Por favor, tente um navegador moderno como Chrome ou Firefox.");
                return;
            }

            // --- VARIÁVEIS DE CONTROLE DA CÂMERA E INTERAÇÃO ---
            const zoomSpeed = 2.0;
            let cameraAngleX = 0;
            let cameraAngleY = 0.2;
            let cameraDistance = 250;
            let isDragging = false;
            let lastMouseX = -1;
            let lastMouseY = -1;
            let cameraTargetNode = null;
            let isOverviewMode = true;
            let isPaused = false;
            let timeMultiplier = 1.0;

            // --- EVENT LISTENERS PARA CONTROLE DA CÂMERA ---
            canvas.addEventListener('mousedown', (event) => {
                isDragging = true;
                lastMouseX = event.clientX;
                lastMouseY = event.clientY;
            });
            canvas.addEventListener('mouseup', () => {
                isDragging = false;
            });
            canvas.addEventListener('mousemove', (event) => {
                if (!isDragging || isOverviewMode) return;
                const deltaX = event.clientX - lastMouseX;
                const deltaY = event.clientY - lastMouseY;
                cameraAngleX += deltaX * 0.005;
                cameraAngleY += deltaY * 0.005;
                cameraAngleY = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, cameraAngleY));
                lastMouseX = event.clientX;
                lastMouseY = event.clientY;
            });
            canvas.addEventListener('wheel', (event) => {
                event.preventDefault();
                cameraDistance += event.deltaY * zoomSpeed;
                cameraDistance = Math.max(5, Math.min(30000, cameraDistance));
            });

            twgl.setAttributePrefix("a_");

            // --- SHADERS ---
            const vs_line = `#version 300 es
                in vec4 a_position;
                uniform mat4 u_projection;
                uniform mat4 u_view;
                uniform mat4 u_world;

                void main() {
                    gl_Position = u_projection * u_view * u_world * a_position;
                }`;

            const fs_line = `#version 300 es
                precision highp float;
                uniform vec4 u_color;
                out vec4 outColor;

                void main() {
                    outColor = u_color;
                }`;

            const vs_planet = `#version 300 es
                in vec4 a_position;
                in vec3 a_normal;
                in vec3 a_tangent;
                in vec2 a_texcoord;

                uniform mat4 u_projection;
                uniform mat4 u_view;
                uniform mat4 u_world;
                uniform vec3 u_viewWorldPosition;

                out vec3 v_normal;
                out vec3 v_tangent;
                out vec3 v_surfaceToView;
                out vec2 v_texcoord;
                out vec3 v_worldPosition;

                void main() {
                    vec4 worldPosition = u_world * a_position;
                    gl_Position = u_projection * u_view * worldPosition;
                    
                    v_worldPosition = worldPosition.xyz;
                    v_surfaceToView = u_viewWorldPosition - worldPosition.xyz;

                    mat3 normalMat = mat3(u_world);
                    v_normal = normalize(normalMat * a_normal);
                    v_tangent = normalize(normalMat * a_tangent);
                    v_texcoord = a_texcoord;
                }`;

            const fs_planet = `#version 300 es
                precision highp float;
                in vec3 v_normal;
                in vec3 v_tangent;
                in vec3 v_surfaceToView;
                in vec2 v_texcoord;
                in vec3 v_worldPosition;

                uniform vec3 diffuse;
                uniform sampler2D diffuseMap;
                uniform vec3 ambient;
                uniform vec3 emissive;
                uniform vec3 specular;
                uniform sampler2D specularMap;
                uniform float shininess;
                uniform sampler2D normalMap;
                uniform float opacity;
                uniform vec3 u_lightWorldPosition;
                uniform vec3 u_ambientLight;
                uniform bool u_isTheSun;

                out vec4 outColor;

                void main () {
                    vec4 diffuseMapColor = texture(diffuseMap, v_texcoord);
                    float effectiveOpacity = opacity * diffuseMapColor.a;

                    if (u_isTheSun) {
                        outColor = vec4(diffuseMapColor.rgb, effectiveOpacity);
                        return;
                    }

                    vec3 surfaceToLightDirection = normalize(u_lightWorldPosition - v_worldPosition);
                    vec3 normal = normalize(v_normal);
                    vec3 surfaceToViewDirection = normalize(v_surfaceToView);
                    vec3 halfVector = normalize(surfaceToLightDirection + surfaceToViewDirection);

                    float fakeLight = dot(surfaceToLightDirection, normal) * .5 + .5;
                    float specularLight = clamp(dot(normal, halfVector), 0.0, 1.0);

                    vec4 specularMapColor = texture(specularMap, v_texcoord);
                    vec3 effectiveSpecular = specular * specularMapColor.rgb;

                    vec3 effectiveDiffuse = diffuse * diffuseMapColor.rgb;
                    
                    outColor = vec4(
                        emissive +
                        ambient * u_ambientLight +
                        effectiveDiffuse * fakeLight +
                        effectiveSpecular * pow(specularLight, shininess),
                        effectiveOpacity
                    );
                }`;

            const lineProgramInfo = twgl.createProgramInfo(gl, [vs_line, fs_line]);
            const meshProgramInfo = twgl.createProgramInfo(gl, [vs_planet, fs_planet]);

            // --- CARREGANDO OS MODELOS 3D ---
            // Para simplificação, vamos usar esferas genéricas
            // Em um cenário real, você carregaria modelos mais detalhados
            async function createSphereModel(gl, programInfo, color) {
                const arrays = {
                    position: { numComponents: 3, data: [] },
                    normal: { numComponents: 3, data: [] },
                    texcoord: { numComponents: 2, data: [] }
                };
                
                // Criar uma esfera simples
                const latitudeBands = 12;
                const longitudeBands = 12;
                const radius = 1.0;
                
                for (let lat = 0; lat <= latitudeBands; lat++) {
                    const theta = lat * Math.PI / latitudeBands;
                    const sinTheta = Math.sin(theta);
                    const cosTheta = Math.cos(theta);
                    
                    for (let lon = 0; lon <= longitudeBands; lon++) {
                        const phi = lon * 2 * Math.PI / longitudeBands;
                        const sinPhi = Math.sin(phi);
                        const cosPhi = Math.cos(phi);
                        
                        const x = cosPhi * sinTheta;
                        const y = cosTheta;
                        const z = sinPhi * sinTheta;
                        const u = 1 - (lon / longitudeBands);
                        const v = 1 - (lat / latitudeBands);
                        
                        arrays.position.data.push(radius * x, radius * y, radius * z);
                        arrays.normal.data.push(x, y, z);
                        arrays.texcoord.data.push(u, v);
                    }
                }
                
                // Gerar índices
                const indices = [];
                for (let lat = 0; lat < latitudeBands; lat++) {
                    for (let lon = 0; lon < longitudeBands; lon++) {
                        const first = (lat * (longitudeBands + 1)) + lon;
                        const second = first + longitudeBands + 1;
                        
                        indices.push(first, second, first + 1);
                        indices.push(second, second + 1, first + 1);
                    }
                }
                
                arrays.indices = indices;
                
                // Criar buffers
                const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);
                const vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);
                
                return {
                    bufferInfo,
                    vao,
                    material: {
                        diffuse: color,
                        diffuseMap: null,
                        ambient: [0.1, 0.1, 0.1],
                        specular: [0.5, 0.5, 0.5],
                        shininess: 32,
                        opacity: 1.0
                    }
                };
            }
            
            // Criar modelos simplificados para cada planeta
            const sunModel = await createSphereModel(gl, meshProgramInfo, [1.0, 0.8, 0.0]);
            const mercuryModel = await createSphereModel(gl, meshProgramInfo, [0.7, 0.7, 0.7]);
            const venusModel = await createSphereModel(gl, meshProgramInfo, [0.9, 0.6, 0.2]);
            const earthModel = await createSphereModel(gl, meshProgramInfo, [0.2, 0.2, 0.8]);
            const moonModel = await createSphereModel(gl, meshProgramInfo, [0.9, 0.9, 0.9]);
            const marsModel = await createSphereModel(gl, meshProgramInfo, [0.8, 0.3, 0.1]);
            const jupiterModel = await createSphereModel(gl, meshProgramInfo, [0.8, 0.7, 0.5]);
            const saturnModel = await createSphereModel(gl, meshProgramInfo, [0.9, 0.8, 0.6]);
            const uranusModel = await createSphereModel(gl, meshProgramInfo, [0.6, 0.8, 0.9]);
            const neptuneModel = await createSphereModel(gl, meshProgramInfo, [0.3, 0.5, 0.9]);

            // --- CARREGAR DADOS ORBITAIS DA NASA ---
            // Dados orbitais simulados para demonstração
            // Em um cenário real, você carregaria de arquivos
            function generateOrbitalData(distance, inclination = 0) {
                const points = [];
                const startDate = new Date(1990, 0, 1);
                const days = 365 * 5; // 5 anos de dados
                
                for (let i = 0; i <= days; i++) {
                    const date = new Date(startDate);
                    date.setDate(date.getDate() + i);
                    
                    const angle = (i / days) * 2 * Math.PI;
                    const x = Math.cos(angle) * distance;
                    const y = Math.sin(angle) * Math.sin(inclination) * distance;
                    const z = Math.sin(angle) * Math.cos(inclination) * distance;
                    
                    points.push({
                        time: i,
                        position: [x, y, z]
                    });
                }
                
                return points;
            }
            
            // Dados orbitais "reais" (simulados)
            const orbitalData = {
                mercury: generateOrbitalData(165, 0.122),
                venus: generateOrbitalData(308, 0.059),
                earth: generateOrbitalData(426, 0),
                mars: generateOrbitalData(650, 0.032),
                jupiter: generateOrbitalData(2216, 0.022),
                saturn: generateOrbitalData(4077, 0.043),
                uranus: generateOrbitalData(8164, 0.013),
                neptune: generateOrbitalData(12840, 0.031),
                moon: (() => {
                    const points = [];
                    const startDate = new Date(1990, 0, 1);
                    const days = 365 * 5; // 5 anos
                    
                    for (let i = 0; i <= days; i++) {
                        const date = new Date(startDate);
                        date.setDate(date.getDate() + i);
                        
                        const angle = (i / 27.3) * 2 * Math.PI; // Ciclo lunar de 27.3 dias
                        const distance = 20;
                        const x = Math.cos(angle) * distance;
                        const y = Math.sin(angle) * distance;
                        const z = 0;
                        
                        points.push({
                            time: i,
                            position: [x, y, z]
                        });
                    }
                    
                    return points;
                })()
            };
            
            // Fator de conversão para unidades da cena
            const AU_TO_SCENE = 426;
            for (const planet in orbitalData) {
                orbitalData[planet].forEach(point => {
                    point.position[0] *= AU_TO_SCENE;
                    point.position[1] *= AU_TO_SCENE;
                    point.position[2] *= AU_TO_SCENE;
                });
            }

            // Ocultar tela de carregamento agora que os dados estão prontos
            loadingScreen.style.display = 'none';

            // --- CONFIGURANDO O GRAFO DE CENA ---
            const solarSystemNode = new Node();
            
            const sunNode = new Node();
            sunNode.drawInfo = [sunModel];
            sunNode.setParent(solarSystemNode);
            
            const planetNodes = {};
            for (const [name, data] of Object.entries(planetData)) {
                const orbitNode = new Node();
                orbitNode.setParent(solarSystemNode);
                
                const planetNode = new Node();
                planetNode.setParent(orbitNode);
                
                planetNodes[name] = { node: planetNode, orbitNode: orbitNode, data: data };
            }
            
            planetNodes.mercury.node.drawInfo = [mercuryModel];
            planetNodes.venus.node.drawInfo = [venusModel];
            planetNodes.earth.node.drawInfo = [earthModel];
            planetNodes.mars.node.drawInfo = [marsModel];
            planetNodes.jupiter.node.drawInfo = [jupiterModel];
            planetNodes.saturn.node.drawInfo = [saturnModel];
            planetNodes.uranus.node.drawInfo = [uranusModel];
            planetNodes.neptune.node.drawInfo = [neptuneModel];

            const moonOrbitNode = new Node();
            moonOrbitNode.setParent(planetNodes.earth.node);

            const moonNode = new Node();
            moonNode.drawInfo = [moonModel];
            moonNode.setParent(moonOrbitNode);
            
            // --- GERAR DADOS DAS ÓRBITAS E RASTROS ---
            const trailMaxLength = 150;
            
            const createTrail = () => {
                const bufferInfo = twgl.createBufferInfoFromArrays(gl, { 
                    position: { numComponents: 3, data: new Float32Array(trailMaxLength * 3), drawType: gl.DYNAMIC_DRAW }
                });
                const vao = twgl.createVAOFromBufferInfo(gl, lineProgramInfo, bufferInfo);
                return { points: [], bufferInfo, vao };
            };
            const earthTrail = createTrail();
            const moonTrail = createTrail();

            // --- CONTROLES DE TECLADO ---
            cameraTargetNode = solarSystemNode;
            window.addEventListener('keydown', (event) => {
                isOverviewMode = false;
                switch (event.key) {
                    case '1': cameraTargetNode = sunNode; cameraDistance = 350; break;
                    case '2': cameraTargetNode = planetNodes.mercury.node; cameraDistance = 30; break;
                    case '3': cameraTargetNode = planetNodes.venus.node; cameraDistance = 40; break;
                    case '4': cameraTargetNode = planetNodes.earth.node; cameraDistance = 50; break;
                    case '5': cameraTargetNode = planetNodes.mars.node; cameraDistance = 40; break;
                    case '6': cameraTargetNode = planetNodes.jupiter.node; cameraDistance = 150; break;
                    case '7': cameraTargetNode = planetNodes.saturn.node; cameraDistance = 120; break;
                    case '8': cameraTargetNode = planetNodes.uranus.node; cameraDistance = 100; break;
                    case '9': cameraTargetNode = planetNodes.neptune.node; cameraDistance = 100; break;
                    case 'm': case 'M': cameraTargetNode = moonNode; cameraDistance = 15; break;
                    case '0': 
                        cameraTargetNode = solarSystemNode; 
                        cameraDistance = 8000; 
                        isOverviewMode = true;
                        break;
                }
            });
            
            // Controles de botão
            document.getElementById('pause-btn').addEventListener('click', () => {
                isPaused = !isPaused;
                document.getElementById('pause-btn').textContent = isPaused ? 'Continuar' : 'Pausar';
            });
            
            document.getElementById('reset-btn').addEventListener('click', () => {
                startTime = performance.now();
            });
            
            // Controle de velocidade
            const speedSlider = document.getElementById('speed-slider');
            const speedDisplay = document.getElementById('speed-display');
            speedSlider.addEventListener('input', () => {
                timeMultiplier = speedSlider.value / 10;
                speedDisplay.textContent = `${timeMultiplier.toFixed(1)}x`;
            });

            const objectsToDraw = [sunNode, moonNode, ...Object.values(planetNodes).map(p => p.node)];
            const fieldOfViewRadians = (d) => d * Math.PI / 180;
            
            // Variável para controlar o tempo
            let startTime = performance.now();

            // =========================================================================
            // CICLO DE RENDERIZAÇÃO
            // =========================================================================
            function drawScene(currentTime) {
                if (!startTime) startTime = currentTime;
                
                if (isPaused) {
                    requestAnimationFrame(drawScene);
                    return;
                }
                
                // Calcular tempo decorrido com multiplicador
                const elapsedTime = (currentTime - startTime) * timeMultiplier;

                twgl.resizeCanvasToDisplaySize(gl.canvas);
                gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
                gl.enable(gl.CULL_FACE);
                gl.enable(gl.DEPTH_TEST);
                gl.clearColor(0, 0, 0, 1);
                gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

                const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
                const projectionMatrix = m4.perspective(fieldOfViewRadians(60), aspect, 0.1, 30000);

                let target, cameraPosition, up;
                if (isOverviewMode) {
                    cameraPosition = [0, 5000, 8000];
                    target = [0, 0, 0];
                    up = [0, 1, 0];
                } else {
                    target = [cameraTargetNode.worldMatrix[12], cameraTargetNode.worldMatrix[13], cameraTargetNode.worldMatrix[14]];
                    const cameraMatrixRotation = m4.multiply(m4.xRotation(cameraAngleY), m4.yRotation(cameraAngleX));
                    const cameraPositionOffset = m4.transformPoint(cameraMatrixRotation, [0, 0, cameraDistance]);
                    cameraPosition = m4.addVectors(target, cameraPositionOffset);
                    up = m4.transformPoint(cameraMatrixRotation, [0, 1, 0]);
                }
                
                const cameraMatrix = m4.lookAt(cameraPosition, target, up);
                const viewMatrix = m4.inverse(cameraMatrix);
                
                // ATUALIZAÇÃO DAS ANIMAÇÕES
                // Rotação do Sol
                m4.multiply(m4.yRotation(0.005), sunNode.localMatrix, sunNode.localMatrix);
                
                // Tempo em dias desde 1990-01-01 (acelerado)
                const daysSince1990 = (elapsedTime * 0.001 * 60) / (24 * 60 * 60);
                
                // Atualizar posições orbitais dos planetas
                for (const [name, p] of Object.entries(planetNodes)) {
                    if (orbitalData[name] && orbitalData[name].length > 0) {
                        const pos = getInterpolatedPosition(orbitalData[name], daysSince1990);
                        p.orbitNode.localMatrix = m4.translation(pos[0], pos[1], pos[2]);
                    }
                    
                    // Rotação do planeta
                    m4.multiply(m4.yRotation(p.data.rotationSpeed), p.node.localMatrix, p.node.localMatrix);
                }
                
                // Atualizar posição da Lua (relativa à Terra)
                if (orbitalData.moon && orbitalData.moon.length > 0) {
                    const earthPos = [
                        planetNodes.earth.orbitNode.worldMatrix[12],
                        planetNodes.earth.orbitNode.worldMatrix[13],
                        planetNodes.earth.orbitNode.worldMatrix[14]
                    ];
                    
                    const moonPos = getInterpolatedPosition(orbitalData.moon, daysSince1990);
                    moonOrbitNode.localMatrix = m4.translation(
                        earthPos[0] + moonPos[0],
                        earthPos[1] + moonPos[1],
                        earthPos[2] + moonPos[2]
                    );
                }
                
                // Rotação da Lua
                m4.multiply(m4.yRotation(-0.01), moonNode.localMatrix, moonNode.localMatrix);

                // ATUALIZAÇÃO DO GRAFO DE CENA
                solarSystemNode.updateWorldMatrix();

                // ATUALIZAÇÃO DOS RASTROS
                const updateTrail = (trail, node) => {
                    const currentPosition = [node.worldMatrix[12], node.worldMatrix[13], node.worldMatrix[14]];
                    trail.points.push(...currentPosition);
                    if (trail.points.length > trailMaxLength * 3) {
                        trail.points.splice(0, 3);
                    }
                    gl.bindBuffer(gl.ARRAY_BUFFER, trail.bufferInfo.attribs.a_position.buffer);
                    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(trail.points));
                };
                updateTrail(earthTrail, planetNodes.earth.node);
                updateTrail(moonTrail, moonNode);

                // DESENHANDO OS MODELOS
                gl.useProgram(meshProgramInfo.program);
                
                const sunWorldPosition = [
                    sunNode.worldMatrix[12],
                    sunNode.worldMatrix[13],
                    sunNode.worldMatrix[14],
                ];
                
                const sharedUniforms = {
                    u_lightWorldPosition: sunWorldPosition,
                    u_ambientLight: [0.1, 0.1, 0.1],
                    u_view: viewMatrix,
                    u_projection: projectionMatrix,
                    u_viewWorldPosition: cameraPosition,
                };
                twgl.setUniforms(meshProgramInfo, sharedUniforms);

                objectsToDraw.forEach((object) => {
                    if (object.drawInfo && object.drawInfo.length > 0) {
                        for (const part of object.drawInfo) {
                            gl.bindVertexArray(part.vao);
                            twgl.setUniforms(meshProgramInfo, {
                                u_world: object.worldMatrix,
                                u_isTheSun: (object === sunNode)
                            }, part.material);
                            twgl.drawBufferInfo(gl, part.bufferInfo);
                        }
                    }
                });

                // DESENHANDO AS LINHAS (RASTROS)
                gl.useProgram(lineProgramInfo.program);
                twgl.setUniforms(lineProgramInfo, { u_view: viewMatrix, u_projection: projectionMatrix });
                
                // Rastro da Terra
                twgl.setUniforms(lineProgramInfo, { u_world: m4.identity(), u_color: [0.4, 0.7, 1.0, 1] });
                gl.bindVertexArray(earthTrail.vao);
                twgl.drawBufferInfo(gl, earthTrail.bufferInfo, gl.LINE_STRIP, earthTrail.points.length / 3);

                // Rastro da Lua
                twgl.setUniforms(lineProgramInfo, { u_world: m4.identity(), u_color: [0.9, 0.9, 0.9, 1] });
                gl.bindVertexArray(moonTrail.vao);
                twgl.drawBufferInfo(gl, moonTrail.bufferInfo, gl.LINE_STRIP, moonTrail.points.length / 3);
                
                requestAnimationFrame(drawScene);
            }
            
            requestAnimationFrame(drawScene);
        }

        main();
