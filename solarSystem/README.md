# 🌌 Simulador do Sistema Solar em WebGL2

Este projeto é uma simulação 3D interativa do sistema solar, renderizada em tempo real no navegador usando WebGL2. A principal característica desta simulação é a utilização de dados de efemérides reais do sistema **HORIZONS**, fornecidos pela **NASA**, para posicionar os planetas e a Lua com precisão científica para qualquer data entre 1990 e 2025.

## ✨ Funcionalidades Principais

* **Visualização 3D:** Modelos 3D texturizados para o Sol, planetas e a Lua.
* **Dados Reais da NASA:** As posições dos corpos celestes são calculadas com base em dados horários do JPL HORIZONS, garantindo uma representação orbital precisa.
* **Interpolação:** Utiliza a interpolação **Catmull-Rom** para criar um movimento contínuo dos planetas entre os pontos de dados horários.
* **Câmera Interativa:** A câmera pode ser livremente rotacionada e ampliada. É possível focar em qualquer planeta, na Lua ou ter uma visão geral do sistema.
* **Controle de Tempo:** A velocidade da simulação pode ser aumentada ou diminuída, permitindo observar os movimentos orbitais em diferentes escalas de tempo.
* **Rastros Orbitais Dinâmicos:** Cada planeta e a Lua deixam um rastro que representa sua trajetória orbital recente, com a duração do rastro correspondendo ao seu período orbital.
* **Iluminação Dinâmica:** Iluminação simples com o Sol como única fonte de luz, afetando a aparência dos planetas.

---

## 🛠️ Tecnologias Utilizadas

* **HTML5** e **CSS3** para a estrutura e estilo da página.
* **JavaScript (ES6+)** para toda a lógica da aplicação.
* **WebGL2** para a renderização 3D acelerada por hardware.
* **TWGL.js:** Uma biblioteca auxiliar que simplifica o uso da API WebGL2.
* **GLSL:** Linguagem de sombreamento utilizada para os shaders de vértice e fragmento.

---

## 🚀 Como Executar o Projeto (Uso do Servidor Local)

**Importante:** Este projeto **não funcionará** se você abrir o arquivo `index.html` diretamente no navegador (usando `file:///...`).

Isso acontece porque o código usa a função `fetch()` para carregar arquivos locais (modelos 3D, texturas e dados da NASA). Por motivos de segurança, os navegadores modernos bloqueiam essas solicitações quando a página é aberta diretamente do sistema de arquivos, um erro conhecido como **CORS (Cross-Origin Resource Sharing)**.

Para que o projeto funcione, você precisa servi-lo a partir de um **servidor web local**. Abaixo está a maneira mais simples de fazer isso:

### Usando o Servidor Embutido do Python

1.  **Clone ou baixe** este repositório para a sua máquina.
2.  **Abra um terminal** (ou Prompt de Comando) na pasta raiz do projeto (a mesma pasta onde o arquivo `index.html` está localizado).
3.  **Execute um dos seguintes comandos**, dependendo da sua versão do Python:

    * **Para Python 3:**
        ```bash
        python -m http.server
        ```
    * **Para Python 2:**
        ```bash
        python -m SimpleHTTPServer
        ```
4.  O terminal mostrará uma mensagem como `Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...`
5.  **Abra o seu navegador** (Chrome, Firefox, etc.) e acesse o endereço: `http://localhost:8000`

A simulação começará a carregar os dados e iniciará a renderização.

---

## 🎮 Controles

| Ação                      | Controle                   |  
| :------------------------ | :------------------------- |  
| **Rotacionar Câmera** | Clicar e arrastar com o mouse |  
| **Aumentar/Diminuir Zoom**| Roda do mouse (scroll)     |  
| **Focar no Sol** | Tecla `1`                  |  
| **Focar em Mercúrio** | Tecla `2`                  |  
| **Focar em Vênus** | Tecla `3`                  |  
| **Focar na Terra** | Tecla `4`                  |  
| **Focar em Marte** | Tecla `5`                  |  
| **Focar em Júpiter** | Tecla `6`                  |  
| **Focar em Saturno** | Tecla `7`                  |  
| **Focar em Urano** | Tecla `8`                  |  
| **Focar em Netuno** | Tecla `9`                  |  
| **Focar na Lua** | Tecla `M`                  |  
| **Visão Geral** | Tecla `0`                  |  
| **Aumentar Velocidade** | Tecla `+`                  |  
| **Diminuir Velocidade** | Tecla `-`                  |  

---

## 📂 Estrutura do Projeto

/
|-- index.html              # Arquivo principal da página
|-- main.js                 # Código principal da simulação em JavaScript
|
|-- /sun/
|   |-- sunR.obj            # Modelo 3D
|   |-- ...                 # Texturas e materiais
|
|-- /earth/
|   |-- earth.obj           # Modelo 3D
|   |-- earth.mtl           # Materiais
|   |-- earth_texture.jpg   # Textura
|   |-- earth.txt           # Dados de efemérides da NASA
|
|-- /moon/
|   |-- ... (e assim por diante para cada corpo celeste)
|
|-- ...

---

## ✒️ Autor

Projeto desenvolvido por **Felipe Leonardo Kerwald Santana**.

* LinkedIn: [Felipe Kerwald](https://www.linkedin.com/in/felipekerwald/)
* GitHub: [Felipe Kerwald](https://github.com/kerwald)
