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
        Object.entries(cores).forEach(([key, value]) => {
            root.style.setProperty(`--${key}`, value);
        });
    }

    /**
     * Aplica configurações de contato
     * @param {Object} contato - Configurações de contato
     */
    static applyContactSettings(contato) {
        if (!contato) return;

        const contactFields = {
            'telPreview': contato.telefone1,
            'tel2Preview': contato.telefone2,
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

        if (contato.telefone2) {
            const tel2Container = document.getElementById('contact-tel2');
            if (tel2Container) {
                tel2Container.classList.toggle('hidden', !contato.telefone2);
            }
        }
    }

    /**
     * Aplica configurações de módulos
     * @param {Object} modules - Configurações de módulos
     */
    static applyModuleSettings(modules) {
        if (!modules) return;

        const sections = ['sobre', 'produtos', 'contato'];
        sections.forEach(section => {
            const isEnabled = modules[section] ?? true;
            const navItem = document.querySelector(`.nav-${section}`);
            const sectionEl = document.getElementById(section);

            if (navItem) navItem.style.display = isEnabled ? '' : 'none';
            if (sectionEl) sectionEl.style.display = isEnabled ? '' : 'none';
        });
    }

    /**
     * Aplica configurações da seção sobre
     * @param {Object} sobre - Configurações da seção sobre
     */
    static applySobreSettings(sobre) {
        if (!sobre) return;

        Helpers.setValue('sobreTextoPreview', sobre.texto, '', 'innerHTML');

        const sobreImagem = document.getElementById('sobreImagemPreview');
        if (sobreImagem && sobre.imagem) {
            sobreImagem.style.backgroundImage = `url(${sobre.imagem})`;
            sobreImagem.setAttribute('data-bg', sobre.imagem);
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
        this.applySobreSettings(config.sobre);

        globalCache.set('config', 'full', { hash: configHash, timestamp: Date.now() });
    }
}

export default ConfigManager;