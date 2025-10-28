/**
 * ✅ OTIMIZADO: Módulo de Helpers com documentação JSDoc
 */

/**
 * Objeto global para armazenar helpers
 * @namespace App.Helpers
 */
const Helpers = {
    /**
     * Define um valor em um elemento do DOM com fallback
     * @param {string} id - ID do elemento
     * @param {string|number|boolean} value - Valor a ser definido
     * @param {string|number|boolean} defaultValue - Valor padrão se value for null/undefined
     * @param {string} [property='textContent'] - Propriedade do elemento a ser modificada
     * @returns {boolean} - True se o elemento foi encontrado e atualizado
     */
    setValue(id, value, defaultValue, property = 'textContent') {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Elemento #${id} não encontrado`);
            return false;
        }

        const finalValue = value ?? defaultValue;
        
        if (property === 'html' || property === 'innerHTML') {
            // Usar DOMPurify para sanitizar HTML
            element.innerHTML = typeof DOMPurify !== 'undefined' 
                ? DOMPurify.sanitize(finalValue)
                : escapeHtml(finalValue);
        } else {
            element[property] = finalValue;
        }
        
        return true;
    },

    /**
     * Define valores em múltiplos elementos de uma vez
     * @param {Object.<string, *>} values - Objeto com IDs e valores
     * @param {Object} options - Opções de configuração
     * @param {*} options.defaultValue - Valor padrão para todos os elementos
     * @param {string} options.property - Propriedade a ser modificada
     * @returns {Object} - Objeto com status de cada operação
     */
    setMultipleValues(values, options = {}) {
        return Object.entries(values).reduce((results, [id, value]) => {
            results[id] = this.setValue(id, value, options.defaultValue, options.property);
            return results;
        }, {});
    },

    /**
     * Define atributos em um elemento
     * @param {string} id - ID do elemento
     * @param {Object.<string, string>} attributes - Objeto com atributos
     * @returns {boolean} - True se o elemento foi encontrado e atualizado
     */
    setAttributes(id, attributes) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Elemento #${id} não encontrado`);
            return false;
        }

        Object.entries(attributes).forEach(([attr, value]) => {
            if (value === null || value === undefined) {
                element.removeAttribute(attr);
            } else {
                element.setAttribute(attr, value);
            }
        });

        return true;
    },

    /**
     * Toggle de classes em um elemento
     * @param {string} id - ID do elemento
     * @param {Object.<string, boolean>} classes - Objeto com classes e estados
     * @returns {boolean} - True se o elemento foi encontrado e atualizado
     */
    toggleClasses(id, classes) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Elemento #${id} não encontrado`);
            return false;
        }

        Object.entries(classes).forEach(([className, active]) => {
            element.classList.toggle(className, active);
        });

        return true;
    },

    /**
     * Cria um elemento com atributos e conteúdo
     * @param {string} tag - Tag do elemento
     * @param {Object} attributes - Atributos do elemento
     * @param {string|Node} [content] - Conteúdo do elemento
     * @returns {HTMLElement} - Elemento criado
     */
    createElement(tag, attributes = {}, content) {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([attr, value]) => {
            if (attr === 'className') {
                element.className = value;
            } else if (attr.startsWith('data-')) {
                element.setAttribute(attr, value);
            } else {
                element[attr] = value;
            }
        });

        if (content) {
            if (content instanceof Node) {
                element.appendChild(content);
            } else {
                element.textContent = content;
            }
        }

        return element;
    },

    /**
     * Formata um número como moeda (R$)
     * @param {number} value - Valor a ser formatado
     * @param {Object} options - Opções de formatação
     * @returns {string} - Valor formatado
     */
    formatCurrency(value, options = {}) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
            ...options
        }).format(value);
    },

    /**
     * Formata um número de telefone
     * @param {string} phone - Número de telefone
     * @returns {string} - Número formatado
     */
    formatPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        const match = cleaned.match(/^(\d{2})(\d{4,5})(\d{4})$/);
        if (match) {
            return `(${match[1]}) ${match[2]}-${match[3]}`;
        }
        return phone;
    }
};

// Exporta o módulo
export default Helpers;