"use strict";

// =========================================================================
// FUNÇÕES AUXILIARES
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
            Object.entries(geometry.data).filter(([, array]) => array.length > 0)
        );
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
        const tangent = Number.isFinite(f) ?
            m4.normalize(m4.scaleVector(m4.subtractVectors(
                m4.scaleVector(dp12, duv13[1]),
                m4.scaleVector(dp13, duv12[1]),
            ), f)) :
            [1, 0, 0];
        tangents.push(...tangent, ...tangent, ...tangent);
    }
    return tangents;
}

var Node = function () {
    this.children = [];
    this.localMatrix = m4.identity();
    this.worldMatrix = m4.identity();
    this.drawInfo = null;
};

Node.prototype.setParent = function (parent) {
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

Node.prototype.updateWorldMatrix = function (matrix) {
    if (matrix) {
        m4.multiply(matrix, this.localMatrix, this.worldMatrix);
    } else {
        m4.copy(this.localMatrix, this.worldMatrix);
    }
    var worldMatrix = this.worldMatrix;
    this.children.forEach(function (child) {
        child.updateWorldMatrix(worldMatrix);
    });
};

async function loadNasaData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Erro ao carregar ${url}: ${response.statusText}`);
        }
        const text = await response.text();
        const data = {};
        const lines = text.split('\n');
        for (const line of lines) {
            if (!line || line.startsWith('$$SOE') || line.startsWith('$$EOE') || line.trim().length === 0) continue;
            const parts = line.trim().split(/\s+/);
            if (parts.length < 6) continue;
            const year = parseInt(parts[0]);
            const doy = parseInt(parts[1]);
            const hour = parseInt(parts[2]);
            const x = parseFloat(parts[3]);
            const y = parseFloat(parts[4]);
            const z = parseFloat(parts[5]);
            if (isNaN(year) || isNaN(doy) || isNaN(hour)) continue;
            if (!data[year]) {
                data[year] = {};
            }
            if (!data[year][doy]) {
                data[year][doy] = {};
            }
            data[year][doy][hour] = { x, y, z };
        }
        return data;
    } catch (error) {
        console.error(`Falha ao processar o arquivo de dados: ${url}`, error);
        return {};
    }
}


function CatmullRom3D(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const calculate = (coord) => 0.5 * (
        (2 * p1[coord]) +
        (-p0[coord] + p2[coord]) * t +
        (2 * p0[coord] - 5 * p1[coord] + 4 * p2[coord] - p3[coord]) * t2 +
        (-p0[coord] + 3 * p1[coord] - 3 * p2[coord] + p3[coord]) * t3
    );
    return {
        x: calculate('x'),
        y: calculate('y'),
        z: calculate('z'),
    };
}

function getNasaCoordsForHour(nasaData, year, day, hour) {
    let currentYear = year;
    let currentDay = day;
    let currentHour = hour;
    const daysInYear = (y) => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 366 : 365;
    while (currentHour < 0) {
        currentHour += 24;
        currentDay--;
        if (currentDay < 1) {
            currentYear--;
            currentDay = daysInYear(currentYear);
        }
    }
    while (currentHour >= 24) {
        currentHour -= 24;
        currentDay++;
        if (currentDay > daysInYear(currentYear)) {
            currentDay = 1;
            currentYear++;

            if (currentYear >= 2025) {
            console.log("Reiniciando a simulação para 1990...");

            // 1. Reinicia as variáveis de tempo
            currentYear = 1990;
            currentDayOfYear = 1;
            currentHour = 0;

            // 2. Limpa os rastros de todos os planetas (A MÁGICA ESTÁ AQUI)
            for (const name of planetNames) {
                planetTrails[name] = []; // Define o rastro como um array vazio
            }

            // 3. Reinicia o contador que adiciona pontos ao rastro
            lastTrailUpdateDay = 0;
          }

        }
    }
    return nasaData?.[currentYear]?.[currentDay]?.[currentHour];
}

// =========================================================================
// FUNÇÃO PRINCIPAL
// =========================================================================

async function main() {

    const canvas = document.querySelector("#canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return;

    const dateDisplay = document.querySelector("#date-display");

    // --- VARIÁVEIS DE CONTROLE E CONFIGURAÇÃO ---
    const zoomSpeed = 2.0;
    let cameraAngleX = 0;
    let cameraAngleY = 0.2;
    let cameraDistance = 8000;
    let isDragging = false;
    let lastMouseX = -1;
    let lastMouseY = -1;
    let cameraTargetNode = null;
    let isOverviewMode = true;
    const planetNames = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
    const AU_SCALE = 400;
    const LUNA_ORBIT_SCALE_VISUAL = 1;
    let simulationSpeed = 24;
    let currentYear = 1990;
    let currentDayOfYear = 1;
    let currentHour = 0;
    

    // --- DADOS PARA O RASTRO DINÂMICO ---
    const orbitalPeriods = {
        mercury: 88,
        venus: 225,
        earth: 365,
        mars: 687,
        jupiter: 4333,
        saturn: 10759,
        uranus: 30687,
        neptune: 60190
    };
    const planetTrails = {};
    planetNames.forEach(name => {
        // Cada planeta agora tem uma lista de segmentos de rastro
        planetTrails[name] = [[]]; 
    });
    // A Lua também tem uma lista de segmentos de rastro
    let moonTrail = [[]]; 
    let lastTrailUpdateDay = 0;


    // --- SHADERS (DEFINIÇÃO) ---
    const vs_line = `#version 300 es
        in vec4 a_position;

        uniform mat4 u_projection;
        uniform mat4 u_view;
        uniform mat4 u_world;

        void main() {
            gl_Position = u_projection * u_view * u_world * a_position;
        }
    `;

    const fs_line = `#version 300 es
        precision highp float;
        
        uniform vec4 u_color;
        
        out vec4 outColor;

        void main() {
            outColor = u_color;
        }
    `;

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
        }
    `;

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
            vec3 halfVector = normalize( surfaceToLightDirection + surfaceToViewDirection );

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
        }
    `;

    // --- CRIAR OS PROGRAMAS DE SHADER ---
    twgl.setAttributePrefix("a_");
    const meshProgramInfo = twgl.createProgramInfo(gl, [vs_planet, fs_planet]);
    const lineProgramInfo = twgl.createProgramInfo(gl, [vs_line, fs_line]);

    // --- CARREGAR DADOS EXTERNOS (NASA) ---
    const planetFiles = {
        mercury: 'mercury/mercury.txt', venus: 'venus/venus.txt', earth: 'earth/earth.txt',
        mars: 'mars/mars.txt', jupiter: 'jupiter/jupiter.txt', saturn: 'saturn/saturn.txt',
        uranus: 'uranus/uranus.txt', neptune: 'neptune/neptune.txt', moon: 'moon/moon.txt'
    };
    console.log("Carregando dados de coordenadas...");
    dateDisplay.textContent = "Carregando dados da NASA...";
    const nasaCoordinates = {};
    const promises = Object.entries(planetFiles).map(async ([name, path]) => {
        nasaCoordinates[name] = await loadNasaData(path);
    });
    await Promise.all(promises);
    console.log("Dados carregados com sucesso!");
    dateDisplay.textContent = "Dados carregados.";

    // --- CARREGAR MODELOS 3D ---
    async function loadModel(gl, programInfo, objHref) {
        const response = await fetch(objHref);
        if (!response.ok) {
            console.error(`Não foi possível carregar o modelo: ${objHref}`);
            return [];
        }
        const text = await response.text();
        const obj = parseOBJ(text);
        const baseHref = new URL(objHref, window.location.href);
        const matTexts = await Promise.all(obj.materialLibs.map(async filename => {
            const matHref = new URL(filename, baseHref).href;
            const response = await fetch(matHref);
            return await response.text();
        }));
        const materials = parseMTL(matTexts.join('\n'));
        const textures = {
            defaultWhite: twgl.createTexture(gl, { src: [255, 255, 255, 255] }),
            defaultNormal: twgl.createTexture(gl, { src: [127, 127, 255, 0] }),
        };
        for (const material of Object.values(materials)) {
            Object.entries(material)
                .filter(([key]) => key.endsWith('Map'))
                .forEach(([key, filename]) => {
                    let texture = textures[filename];
                    if (!texture) {
                        const textureHref = new URL(filename, baseHref).href;
                        texture = twgl.createTexture(gl, { src: textureHref, flipY: true });
                        textures[filename] = texture;
                    }
                    material[key] = texture;
                });
        }
        const defaultMaterial = {
            diffuse: [1, 1, 1], diffuseMap: textures.defaultWhite, normalMap: textures.defaultNormal,
            ambient: [0, 0, 0], specular: [1, 1, 1], specularMap: textures.defaultWhite,
            shininess: 400, opacity: 1,
        };
        return obj.geometries.map(({ material, data }) => {
            if (data.position.length === 0) return;
            if (data.texcoord && data.normal) { data.tangent = generateTangents(data.position, data.texcoord); }
            else { data.tangent = { value: [1, 0, 0] }; }
            if (!data.texcoord) data.texcoord = { value: [0, 0] };
            if (!data.normal) data.normal = { value: [0, 0, 1] };
            const bufferInfo = twgl.createBufferInfoFromArrays(gl, data);
            const vao = twgl.createVAOFromBufferInfo(gl, programInfo, bufferInfo);
            return {
                material: { ...defaultMaterial, ...materials[material] },
                bufferInfo, vao,
            };
        }).filter(part => part !== undefined);
    }
    
    const sunParts = await loadModel(gl, meshProgramInfo, 'sun/sunR.obj');
    const mercuryParts = await loadModel(gl, meshProgramInfo, 'mercury/mercury.obj');
    const venusParts = await loadModel(gl, meshProgramInfo, 'venus/venus.obj');
    const earthParts = await loadModel(gl, meshProgramInfo, 'earth/earth.obj');
    const moonParts = await loadModel(gl, meshProgramInfo, 'moon/moon.obj');
    const marsParts = await loadModel(gl, meshProgramInfo, 'mars/mars.obj');
    const jupiterParts = await loadModel(gl, meshProgramInfo, 'jupiter/jupiter.obj');
    const saturnParts = await loadModel(gl, meshProgramInfo, 'saturn/saturn.obj');
    const uranusParts = await loadModel(gl, meshProgramInfo, 'uranus/uranus.obj');
    const neptuneParts = await loadModel(gl, meshProgramInfo, 'neptune/neptune.obj');

    // --- CONFIGURAR O GRAFO DE CENA ---
    const solarSystemNode = new Node();
    const sunNode = new Node();
    sunNode.drawInfo = sunParts;
    sunNode.setParent(solarSystemNode);
    
    const planetNodes = {};
    for (const name of planetNames) {
        const planetNode = new Node();
        planetNode.setParent(solarSystemNode);
        planetNodes[name] = { node: planetNode };
    }
    
    planetNodes.mercury.node.drawInfo = mercuryParts;
    planetNodes.venus.node.drawInfo = venusParts;
    planetNodes.earth.node.drawInfo = earthParts;
    planetNodes.mars.node.drawInfo = marsParts;
    planetNodes.jupiter.node.drawInfo = jupiterParts;
    planetNodes.saturn.node.drawInfo = saturnParts;
    planetNodes.uranus.node.drawInfo = uranusParts;
    planetNodes.neptune.node.drawInfo = neptuneParts;

    const moonNode = new Node();
    moonNode.drawInfo = moonParts;
    moonNode.setParent(planetNodes.earth.node);
    
    // --- CONTROLES DE MOUSE E TECLADO ---
    canvas.addEventListener('mousedown', (event) => { isDragging = true; lastMouseX = event.clientX; lastMouseY = event.clientY; });
    canvas.addEventListener('mouseup', () => { isDragging = false; });
    canvas.addEventListener('mousemove', (event) => {
        if (!isDragging) return;
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
        cameraDistance = Math.max(5, Math.min(50000, cameraDistance));
    });
    
    cameraTargetNode = solarSystemNode;
    window.addEventListener('keydown', (event) => {
        switch (event.key) {
            case '1': cameraTargetNode = sunNode; cameraDistance = 350; isOverviewMode = false; break;
            case '2': cameraTargetNode = planetNodes.mercury.node; cameraDistance = 30; isOverviewMode = false; break;
            case '3': cameraTargetNode = planetNodes.venus.node; cameraDistance = 40; isOverviewMode = false; break;
            case '4': cameraTargetNode = planetNodes.earth.node; cameraDistance = 50; isOverviewMode = false; break;
            case '5': cameraTargetNode = planetNodes.mars.node; cameraDistance = 40; isOverviewMode = false; break;
            case '6': cameraTargetNode = planetNodes.jupiter.node; cameraDistance = 150; isOverviewMode = false; break;
            case '7': cameraTargetNode = planetNodes.saturn.node; cameraDistance = 120; isOverviewMode = false; break;
            case '8': cameraTargetNode = planetNodes.uranus.node; cameraDistance = 100; isOverviewMode = false; break;
            case '9': cameraTargetNode = planetNodes.neptune.node; cameraDistance = 100; isOverviewMode = false; break;
            case 'm': case 'M': cameraTargetNode = moonNode; cameraDistance = 15; isOverviewMode = false; break;
            case '0': cameraTargetNode = solarSystemNode; cameraDistance = 8000; isOverviewMode = true; break;
            case '+': simulationSpeed += 24; break;
            case '-': simulationSpeed = Math.max(1, simulationSpeed - 24); break;
        }
    });

    // --- LOOP DE RENDERIZAÇÃO ---
    const objectsToDraw = [sunNode, moonNode, ...Object.values(planetNodes).map(p => p.node)];
    const fieldOfViewRadians = (d) => d * Math.PI / 180;
    let lastTime = 0;
    
    function isLeap(year) {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }

    // =========================================================================
    // INÍCIO DA FUNÇÃO DE DESENHO PRINCIPAL
    // =========================================================================

// Variáveis para o novo loop de simulação
let timeAccumulator = 0;
const SIMULATION_STEP = 1.0; 

function drawScene(time) {
    time *= 0.001;
    const deltaTime = time - lastTime;
    lastTime = time;

    timeAccumulator += simulationSpeed * deltaTime;

    // --- 1. LOOP DE SIMULAÇÃO (SUB-STEPPING) ---
    while (timeAccumulator >= SIMULATION_STEP) {

        // --- A. Avançar o tempo ---
        currentHour += SIMULATION_STEP;
        while (currentHour >= 24) {
            currentHour -= 24;
            currentDayOfYear++;
            const daysInYear = isLeap(currentYear) ? 366 : 365;
            if (currentDayOfYear > daysInYear) {
                currentDayOfYear = 1;
                currentYear++;
                if (currentYear >= 2025) {
                    currentYear = 1990;
                    // REINICIA O RASTRO CRIANDO UM NOVO SEGMENTO
                    planetNames.forEach(name => { planetTrails[name] = [[]]; });
                    moonTrail = [[]];
                    lastTrailUpdateDay = 0;
                }
            }
        }

        // --- B. Atualizar Posições ---
        let earthInterpolatedCoords = null;
        m4.yRotate(sunNode.localMatrix, 0.0005, sunNode.localMatrix);
        const baseHour = Math.floor(currentHour);
        const t = currentHour - baseHour;

        // Planetas
        for (const name of planetNames) {
            const p = planetNodes[name];
            const planetData = nasaCoordinates[name];
            const p0 = getNasaCoordsForHour(planetData, currentYear, currentDayOfYear, baseHour - 1);
            const p1 = getNasaCoordsForHour(planetData, currentYear, currentDayOfYear, baseHour);
            const p2 = getNasaCoordsForHour(planetData, currentYear, currentDayOfYear, baseHour + 1);
            const p3 = getNasaCoordsForHour(planetData, currentYear, currentDayOfYear, baseHour + 2);

            let currentCoords = null;
            if (p0 && p1 && p2 && p3) {
                currentCoords = CatmullRom3D(p0, p1, p2, p3, t);
            } else if (p1) {
                currentCoords = p1;
            }

            if (currentCoords) {
                if (name === 'earth') {
                    earthInterpolatedCoords = currentCoords;
                }
                const x_pos = currentCoords.x * AU_SCALE;
                const y_pos = currentCoords.z * AU_SCALE;
                const z_pos = currentCoords.y * AU_SCALE;
                p.node.localMatrix = m4.translation(x_pos, y_pos, z_pos);
                m4.yRotate(p.node.localMatrix, time * 0.05, p.node.localMatrix);
            }
        }

        // Lua

        let moonInterpolatedCoords = null;
        const moonData = nasaCoordinates.moon;
        const LUNA_INTERPOLATION_STEP = 6; //  Suavização específica para a Lua

        const m0 = getNasaCoordsForHour(moonData, currentYear, currentDayOfYear, baseHour - LUNA_INTERPOLATION_STEP);
        const m1 = getNasaCoordsForHour(moonData, currentYear, currentDayOfYear, baseHour);
        const m2 = getNasaCoordsForHour(moonData, currentYear, currentDayOfYear, baseHour + LUNA_INTERPOLATION_STEP);
        const m3 = getNasaCoordsForHour(moonData, currentYear, currentDayOfYear, baseHour + 2 * LUNA_INTERPOLATION_STEP);

        if (m0 && m1 && m2 && m3) {
            moonInterpolatedCoords = CatmullRom3D(m0, m1, m2, m3, t);
        } else if (m1) {
            moonInterpolatedCoords = m1;
        }

        // --- C. Calcular Posição Relativa e Matrizes Finais ---
        if (earthInterpolatedCoords && moonInterpolatedCoords) {
            const relativePos = {
                x: moonInterpolatedCoords.x - earthInterpolatedCoords.x,
                y: moonInterpolatedCoords.y - earthInterpolatedCoords.y,
                z: moonInterpolatedCoords.z - earthInterpolatedCoords.z,
            };
            const LUNA_VISUAL_SCALE = 10.0;
            const x_pos = relativePos.x * LUNA_VISUAL_SCALE * AU_SCALE;
            const y_pos = relativePos.z * LUNA_VISUAL_SCALE * AU_SCALE;
            const z_pos = relativePos.y * LUNA_VISUAL_SCALE * AU_SCALE;
            moonNode.localMatrix = m4.translation(x_pos, y_pos, z_pos);
            m4.yRotate(moonNode.localMatrix, time * 0.01, moonNode.localMatrix);
        }
        
        solarSystemNode.updateWorldMatrix();

        // --- D. Adicionar Ponto ao Rastro (de forma segura) ---
        const totalSimulatedDays = (currentYear - 1990) * 365.25 + currentDayOfYear;
        
        for (const name of planetNames) {
            const planetNode = planetNodes[name]?.node;
            if (planetNode) {
                const position = [planetNode.worldMatrix[12], planetNode.worldMatrix[13], planetNode.worldMatrix[14]];
                // Adiciona ao último segmento do rastro
                const segments = planetTrails[name];
                segments[segments.length - 1].push({ position, creationTime: totalSimulatedDays });
            }
        }
        
        // SÓ ADICIONA O PONTO DA LUA SE A POSIÇÃO FOI ATUALIZADA
        if (earthInterpolatedCoords && moonInterpolatedCoords) {
            const position = [moonNode.worldMatrix[12], moonNode.worldMatrix[13], moonNode.worldMatrix[14]];
            const segments = moonTrail;
            segments[segments.length - 1].push({ position, creationTime: totalSimulatedDays });
        }

        timeAccumulator -= SIMULATION_STEP;
    } // Fim do loop de simulação

    // --- 2. GERENCIAR PONTOS ANTIGOS DO RASTRO ---
    const totalSimulatedDays = (currentYear - 1990) * 365.25 + currentDayOfYear;
    for (const name of planetNames) {
        const period = orbitalPeriods[name];
        // Filtra os pontos em cada segmento
        planetTrails[name].forEach((segment, i) => {
            planetTrails[name][i] = segment.filter(point => totalSimulatedDays - point.creationTime < period);
        });
    }
    const moonOrbitalPeriod = orbitalPeriods.earth;
    moonTrail.forEach((segment, i) => {
        moonTrail[i] = segment.filter(point => totalSimulatedDays - point.creationTime < moonOrbitalPeriod);
    });

    // --- 3. RENDERIZAÇÃO ---
    dateDisplay.textContent = `Data: ${currentYear} / Dia: ${currentDayOfYear} / Hora: ${Math.floor(currentHour).toString().padStart(2, '0')}:00 | Velocidade: ${simulationSpeed}h/s`;
    twgl.resizeCanvasToDisplaySize(gl.canvas);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const projectionMatrix = m4.perspective(fieldOfViewRadians(60), aspect, 0.1, 50000);
    let target, cameraPosition, up;
    if (isOverviewMode) {
        target = [0, 0, 0];
        cameraPosition = [0, cameraDistance * 0.6, cameraDistance];
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

    // --- 4. DESENHAR OBJETOS ---
    gl.useProgram(meshProgramInfo.program);
    const sharedUniforms = { u_ambientLight: [0.2, 0.2, 0.2], u_view: viewMatrix, u_projection: projectionMatrix, u_viewWorldPosition: cameraPosition, u_lightWorldPosition: [0, 0, 0] };
    twgl.setUniforms(meshProgramInfo, sharedUniforms);
    for (const object of objectsToDraw) {
        if (object.drawInfo && object.drawInfo.length > 0) {
            for (const part of object.drawInfo) {
                gl.bindVertexArray(part.vao);
                const uniforms = { u_world: object.worldMatrix, ...part.material };
                uniforms.u_isTheSun = (object === sunNode);
                twgl.setUniforms(meshProgramInfo, uniforms);
                twgl.drawBufferInfo(gl, part.bufferInfo);
            }
        }
    }

    // --- 5. DESENHAR OS RASTROS (MÉTODO ROBUSTO) ---
    gl.useProgram(lineProgramInfo.program);
    twgl.setUniforms(lineProgramInfo, {
        u_projection: projectionMatrix,
        u_view: viewMatrix,
        u_world: m4.identity(),
    });

    const drawTrail = (segments, color) => {
        twgl.setUniforms(lineProgramInfo, { u_color: color });
        for (const segment of segments) {
            if (segment.length > 1) {
                const vertices = segment.flatMap(p => p.position);
                const bufferInfo = twgl.createBufferInfoFromArrays(gl, { position: vertices });
                const vao = twgl.createVAOFromBufferInfo(gl, lineProgramInfo, bufferInfo);
                gl.bindVertexArray(vao);
                twgl.drawBufferInfo(gl, bufferInfo, gl.LINE_STRIP);
            }
        }
    };
    
    for (const name of planetNames) {
        drawTrail(planetTrails[name], [1, 1, 1, 0.6]);
    }
    drawTrail(moonTrail, [0.7, 0.7, 0.8, 0.5]);
    
    requestAnimationFrame(drawScene);
  }
  requestAnimationFrame(drawScene);
}

main();