/**
 * ✅ OTIMIZADO: Módulo de configuração com funções específicas
 * @module ConfigManager
 */

import Helpers from './helpers.js';
import { globalCache } from './smart-cache.js';

/**
 * @typedef {Object} ConfigSection
 * @property {Object} cores - Configurações de cores
 * @property {Object} contato - Configurações de contato
 * @property {Object} modules - Configurações de módulos
 * @property {Object} sobre - Configurações da seção sobre
 * @property {Object} global_settings - Configurações globais
 */

export class ConfigManager {
    /**
     * Aplica configurações de fonte
     * @param {Object} settings - Configurações globais
     */
    static applyFontSettings(settings) {
        if (!settings) return;

        if (settings.fontUrl) {
            let fontLink = document.getElementById('dynamic-font');
            if (!fontLink) {
                fontLink = document.createElement('link');
                fontLink.id = 'dynamic-font';
                fontLink.rel = 'stylesheet';
                document.head.appendChild(fontLink);
            }
            fontLink.href = settings.fontUrl;
        }

        if (settings.fontFamily) {
            document.body.style.fontFamily = settings.fontFamily;
        }
    }

    /**
     * Aplica configurações de rastreamento
     * @param {Object} settings - Configurações globais
     */
    static applyTrackingCode(settings) {
        if (!settings?.trackingCode) return;

        const code = settings.trackingCode;
        const isGoogleAnalytics = code.includes('googletagmanager.com') ||
            code.includes('analytics.google.com');
        const isFacebookPixel = code.includes('facebook.net/en_US/fbevents.js');
        const isHotjar = code.includes('static.hotjar.com');

        if (!(isGoogleAnalytics || isFacebookPixel || isHotjar)) {
            console.warn('⚠️ Código de rastreamento não reconhecido');
            return;
        }

        // Lista de domínios permitidos
        const allowedDomains = [
            'www.googletagmanager.com',
            'analytics.google.com',
            'connect.facebook.net',
            'static.hotjar.com'
        ];

        // Sanitizar com DOMPurify
        const cleanCode = DOMPurify.sanitize(code, {
            ALLOWED_TAGS: ['script'],
            ALLOWED_ATTR: ['src', 'async', 'defer'],
            ADD_TAGS: ['script'],
            ALLOW_UNKNOWN_PROTOCOLS: false,
            RETURN_DOM: true
        });

        this.injectTrackingScripts(cleanCode, allowedDomains);
    }

    /**
     * Injeta scripts de rastreamento de forma segura
     * @private
     */
    static injectTrackingScripts(cleanCode, allowedDomains) {
        const scripts = cleanCode.querySelectorAll('script');
        scripts.forEach(script => {
            const scriptSrc = script.src;
            if (scriptSrc && allowedDomains.some(domain => scriptSrc.includes(domain))) {
                const newScript = document.createElement('script');
                newScript.src = scriptSrc;
                if (script.async) newScript.async = true;
                document.body.appendChild(newScript);
            }
        });
    }

    /**
     * Aplica configurações de cores
     * @param {Object} cores - Configurações de cores
     */
    static applyColorSettings(cores) {
        if (!cores) return;

        const root = document.documentElement;

        // Tailwind v3/v4 variable mapping
        if (cores.primaria) {
            root.style.setProperty('--primary', cores.primaria);
            // Also set specific RGB values if needed by Tailwind config for opacity support
            // root.style.setProperty('--color-primary', cores.primaria); 
        }

        if (cores.secundaria) {
            root.style.setProperty('--secondary', cores.secundaria);
        }
    }

    /**
     * Aplica configurações de contato
     * @param {Object} contato - Configurações de contato
     */
    static applyContactSettings(contato) {
        if (!contato) return;

        const contactFields = {
            'telPreview': contato.telefone1,
            'telPreview2': contato.telefone2,
            'emailPreview': contato.email,
            'enderecoPreview': contato.endereco
        };

        Helpers.setMultipleValues(contactFields, { property: 'textContent' });

        // Atualiza links
        if (contato.telefone1) {
            Helpers.setAttributes('telLink1', {
                'href': `tel:${contato.telefone1.replace(/\D/g, '')}`
            });
        }

        // Atualiza link do telefone 2 se existir
        if (contato.telefone2) {
            Helpers.setAttributes('telLink2', {
                'href': `tel:${contato.telefone2.replace(/\D/g, '')}`
            });
        }

        // Lógica corrigida para Telefone 2
        const tel2Container = document.getElementById('contact-tel2');
        if (tel2Container) {
            // Verifica se existe, não é vazio e não é "undefined" (string)
            const val = contato.telefone2;
            const hasTel2 = val &&
                typeof val === 'string' &&
                val.trim() !== '' &&
                val.toLowerCase() !== 'undefined' &&
                val.toLowerCase() !== 'null';

            tel2Container.classList.toggle('hidden', !hasTel2);
        }
    }

    /**
     * Aplica configurações de módulos
     * @param {Object} modules - Configurações de módulos
     */
    /**
     * Aplica configurações de módulos
     * @param {Object} modules - Configurações de módulos
     */
    static applyModuleSettings(modules) {
        if (!modules) return;

        // Mapeamento direto de chaves para IDs
        const sectionMap = {
            'sobre': 'sobre',
            'produtos': 'produtos',
            'contato': 'contato'
        };

        for (const [key, id] of Object.entries(sectionMap)) {
            const isEnabled = modules[key] !== false; // Default to true

            // Toggle Section
            const sectionEl = document.getElementById(id);
            if (sectionEl) {
                if (isEnabled) {
                    sectionEl.classList.remove('hidden');
                    sectionEl.style.display = ''; // Clear inline styles
                } else {
                    sectionEl.classList.add('hidden');
                    sectionEl.style.display = 'none'; // Force hide
                }
            }

            // Toggle Nav Items (Desktop & Mobile)
            const navItems = document.querySelectorAll(`.nav-${key}`);
            navItems.forEach(navItem => {
                if (isEnabled) {
                    navItem.classList.remove('hidden');
                    navItem.style.display = '';
                } else {
                    navItem.classList.add('hidden');
                    navItem.style.display = 'none';
                }
            });
        }
    }

    /**
     * Aplica todas as configurações
     * @param {ConfigSection} config - Configuração completa
     */
    static applyConfig(config) {
        const cached = globalCache.get('config', 'full');
        const configHash = JSON.stringify(config);

        if (cached && cached.hash === configHash) {
            console.log('📦 Usando configurações em cache');
            return;
        }

        this.applyFontSettings(config.global_settings);
        this.applyTrackingCode(config.global_settings);
        this.applyColorSettings(config.cores);
        this.applyContactSettings(config.contato);
        this.applyModuleSettings(config.modules);


        globalCache.set('config', 'full', { hash: configHash, timestamp: Date.now() });
    }
}

// Expor para o escopo global para compatibilidade com public.js
window.ConfigManager = ConfigManager;

export default ConfigManager;