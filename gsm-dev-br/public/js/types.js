/**
 * @fileoverview Documentação principal do Site Builder CMS
 * @version 1.0.0
 */

/**
 * @namespace SiteBuilder
 * @description Namespace principal do Site Builder CMS
 */

/**
 * @typedef {Object} Product
 * @property {string} id - ID único do produto
 * @property {string} nome - Nome do produto
 * @property {string} descricao - Descrição do produto
 * @property {string} imagem - URL da imagem do produto
 * @property {number} preco - Preço do produto
 * @property {boolean} [destaque] - Se o produto está em destaque
 */

/**
 * @typedef {Object} ContactInfo
 * @property {string} telefone1 - Telefone principal
 * @property {string} [telefone2] - Telefone secundário
 * @property {string} email - Email de contato
 * @property {string} endereco - Endereço físico
 * @property {Object} [coordenadas] - Coordenadas geográficas
 * @property {number} coordenadas.lat - Latitude
 * @property {number} coordenadas.lng - Longitude
 */

/**
 * @typedef {Object} SiteConfig
 * @property {Object} cores - Configurações de cores do site
 * @property {ContactInfo} contato - Informações de contato
 * @property {Object} modules - Configuração de módulos ativos
 * @property {Object} sobre - Conteúdo da seção Sobre
 * @property {Object} global_settings - Configurações globais
 * @property {Array<Product>} produtos - Lista de produtos
 */

/**
 * Estado global da aplicação
 * @type {Object}
 * @property {Object} modules - Estado dos módulos
 * @property {Array<Product>} produtos - Lista de produtos
 * @property {boolean} hasUnsavedChanges - Indica mudanças não salvas
 */