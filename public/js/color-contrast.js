/**
 * Ferramentas de Contraste de Cor para Acessibilidade (WCAG)
 * @version 1.0.0
 */

/**
 * Converte um valor de componente de cor sRGB (0-255) para um valor linear (0-1).
 * @param {number} c - O valor do componente de cor (R, G ou B) de 0 a 255.
 * @returns {number} O valor linear do componente de cor.
 */
function sRGBtoLinear(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Calcula a luminância relativa de uma cor RGB.
 * @param {number} r - O componente vermelho (0-255).
 * @param {number} g - O componente verde (0-255).
 * @param {number} b - O componente azul (0-255).
 * @returns {number} A luminância relativa da cor.
 */
function getRelativeLuminance(r, g, b) {
  const linearR = sRGBtoLinear(r);
  const linearG = sRGBtoLinear(g);
  const linearB = sRGBtoLinear(b);
  return 0.2126 * linearR + 0.7152 * linearG + 0.0722 * linearB;
}

/**
 * Converte uma string de cor HEX ou RGB para um objeto RGB.
 * Suporta formatos #RRGGBB, #RGB e rgb(r, g, b).
 * @param {string} color - A string de cor (ex: "#FFFFFF", "rgb(255, 255, 255)").
 * @returns {{r: number, g: number, b: number} | null} Um objeto RGB ou null se o formato for inválido.
 */
function colorToRgb(color) {
  if (!color || typeof color !== 'string') {
    return null;
  }

  // Handle rgb(r, g, b) string
  if (color.startsWith('rgb')) {
    const result = /rgb[a]?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
    if (!result) return null;
    return {
        r: parseInt(result[1], 10),
        g: parseInt(result[2], 10),
        b: parseInt(result[3], 10),
    };
  }

  // Handle hex string
  let r = 0, g = 0, b = 0;
  const hexClean = color.startsWith('#') ? color.slice(1) : color;

  if (hexClean.length === 3) {
    r = parseInt(hexClean[0] + hexClean[0], 16);
    g = parseInt(hexClean[1] + hexClean[1], 16);
    b = parseInt(hexClean[2] + hexClean[2], 16);
  } else if (hexClean.length === 6) {
    r = parseInt(hexClean.substring(0, 2), 16);
    g = parseInt(hexClean.substring(2, 4), 16);
    b = parseInt(hexClean.substring(4, 6), 16);
  } else {
    return null; // Formato inválido
  }

  return { r, g, b };
}

/**
 * Calcula a taxa de contraste entre duas cores, conforme as diretrizes WCAG 2.1.
 * @param {string} color1 - A primeira cor em formato HEX ou RGB.
 * @param {string} color2 - A segunda cor em formato HEX ou RGB.
 * @returns {number | null} A taxa de contraste (entre 1 e 21) ou null se as cores forem inválidas.
 */
function getContrastRatio(color1, color2) {
  const rgb1 = colorToRgb(color1);
  const rgb2 = colorToRgb(color2);

  if (!rgb1 || !rgb2) {
    console.error("Formato de cor inválido fornecido. Uma das cores ou ambas são inválidas:", color1, color2);
    return null;
  }

  const luminance1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const luminance2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);

  const L1 = Math.max(luminance1, luminance2);
  const L2 = Math.min(luminance1, luminance2);

  return (L1 + 0.05) / (L2 + 0.05);
}

/**
 * Determina a melhor cor de texto (preto ou branco) para um determinado fundo.
 * @param {string} backgroundColorHex - A cor de fundo em formato HEX.
 * @returns {string} Retorna '#FFFFFF' (branco) ou '#000000' (preto).
 */
function getAccessibleTextColor(backgroundColorHex) {
    const white = '#FFFFFF';
    const black = '#000000';

    const contrastWithWhite = getContrastRatio(backgroundColorHex, white);
    const contrastWithBlack = getContrastRatio(backgroundColorHex, black);

    // Retorna a cor que tiver maior contraste
    return contrastWithWhite > contrastWithBlack ? white : black;
}

// Exporta as funções para serem usadas em outros módulos
window.ColorContrast = {
    getContrastRatio,
    getAccessibleTextColor
};
