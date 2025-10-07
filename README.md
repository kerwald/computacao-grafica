# 📂 Projetos de Computação Gráfica

---

## 🚀 Projetos

Aqui está uma visão geral dos projetos incluídos neste diretório:

### 1. Sistema Solar Interativo em WebGL2

Uma simulação 3D interativa do sistema solar renderizada em tempo real com WebGL2. As posições dos planetas são baseadas em dados de efemérides reais do sistema HORIZONS da NASA, com interpolação Catmull-Rom para garantir um movimento orbital suave e preciso.

* **Tecnologias e Conceitos:**
    * `WebGL2` e `GLSL` para renderização 3D.
    * Carregamento de modelos `.obj` e texturas.
    * Interpolação de curvas com Splines **Catmull-Rom**.
    * Uso de dados científicos (JPL HORIZONS - NASA).
    * Câmera interativa e controle de tempo da simulação.

* ➡️ **[Acessar o Projeto](./solarSystem/)** 

---

### 2. Desenho de Curvas com Spline 2D (Catmull-Rom)

Este projeto demonstra a implementação do algoritmo de **Catmull-Rom** para desenhar curvas 2D suaves e interpoladas. O usuário pode adicionar pontos de controle na tela, e a aplicação desenha dinamicamente uma spline que passa por esses pontos, ilustrando um conceito fundamental em modelagem de curvas.

* **Tecnologias e Conceitos:**
    * `HTML5 Canvas` para renderização 2D.
    * Interpolação de Curvas (Splines).
    * Algoritmo **Catmull-Rom**.
    * Manipulação de eventos de mouse para interatividade.

* ➡️ **[Acessar o Projeto](./drawingA2dSpline/)**
  
---
### 3. Gerador de Triângulo de Sierpinski

Uma implementação do clássico fractal Triângulo de Sierpinski, gerado através do método iterativo conhecido como **"Jogo do Caos" (Chaos Game)**. A aplicação permite que o usuário defina os vértices iniciais e, a partir daí, constrói o fractal ponto a ponto, ilustrando como padrões complexos podem emergir de regras muito simples e aleatórias.

* **Tecnologias e Conceitos:**
    * `HTML5 Canvas` para renderização 2D.
    * Geometria Fractal.
    * **Método Iterativo (Jogo do Caos)**.
    * Geração de números aleatórios.

* ➡️ **[Acessar o Projeto](./trianguloDeSierpinski/)** 
---

## ⚙️ Como Executar

O projeto solarSystem possui README proprio mas, de modo geral:

* **Projetos WebGL (como o Sistema Solar):** Precisam ser executados a partir de um **servidor local** para evitar erros de CORS ao carregar modelos e texturas.
* **Projetos 2D (Canvas):** Geralmente podem ser executados abrindo o arquivo `index.html` diretamente no navegador.

---

## ✒️ Autor

Desenvolvido por **Felipe Leonardo Kerwald Santana**.

* LinkedIn: [Felipe Kerwald](https://www.linkedin.com/in/felipekerwald/)
* GitHub: [Felipe Kerwald](https://github.com/kerwald)
