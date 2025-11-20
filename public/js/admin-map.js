/**
 * ✅ OTIMIZADO: Gerenciador do mapa administrativo
 * @module AdminMap
 */

import LeafletLoader from './leaflet-loader.js';

class AdminMap {
    constructor() {
        /** @type {Object} */
        this.map = null;

        /** @type {Object} */
        this.marker = null;

        /** @type {HTMLElement} */
        this.container = null;

        /** @type {boolean} */
        this.isInitialized = false;

        /** @type {Function[]} */
        this.initCallbacks = [];

        // Bind methods
        this.init = this.init.bind(this);
        this.onMapClick = this.onMapClick.bind(this);
        this.updateMarker = this.updateMarker.bind(this);
    }

    /**
     * Inicializa o mapa quando o container estiver pronto
     * @param {string} containerId - ID do container do mapa
     * @returns {Promise<void>}
     */
    async init(containerId) {
        // Aguarda o container estar disponível
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.warn(`Container ${containerId} não encontrado. Aguardando...`);
            return new Promise(resolve => {
                const observer = new MutationObserver(() => {
                    this.container = document.getElementById(containerId);
                    if (this.container) {
                        observer.disconnect();
                        this.initMap().then(resolve);
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            });
        }

        return this.initMap();
    }

    /**
     * Inicializa o mapa Leaflet
     * @private
     */
    async initMap() {
        if (this.isInitialized) return;

        try {
            // Carrega o Leaflet sob demanda
            const { map, marker } = await LeafletLoader.initMap(
                this.container.id,
                -23.550520,  // São Paulo
                -46.633308,
                13
            );

            this.map = map;
            this.marker = marker;

            // Configura eventos
            this.map.on('click', this.onMapClick);

            // Marca como inicializado
            this.isInitialized = true;

            // Executa callbacks pendentes
            this.initCallbacks.forEach(cb => cb());
            this.initCallbacks = [];

        } catch (error) {
            console.error('Erro ao inicializar mapa:', error);
            throw error;
        }
    }

    /**
     * Handler de clique no mapa
     * @private
     */
    onMapClick(e) {
        const latlng = e.latlng;
        this.updateMarker(latlng.lat, latlng.lng);

        // Dispara evento personalizado
        const event = new CustomEvent('map:coordsChanged', {
            detail: { lat: latlng.lat, lng: latlng.lng }
        });
        window.dispatchEvent(event);
    }

    /**
     * Atualiza a posição do marcador
     * @param {number} lat - Latitude
     * @param {number} lng - Longitude
     */
    updateMarker(lat, lng) {
        if (!this.isInitialized) {
            this.initCallbacks.push(() => this.updateMarker(lat, lng));
            return;
        }

        this.marker.setLatLng([lat, lng]);
        this.map.setView([lat, lng]);
    }

    /**
     * Define o zoom do mapa
     * @param {number} level - Nível de zoom
     */
    setZoom(level) {
        if (!this.isInitialized) {
            this.initCallbacks.push(() => this.setZoom(level));
            return;
        }

        this.map.setZoom(level);
    }

    /**
     * Atualiza o tamanho do mapa
     */
    invalidateSize() {
        if (this.isInitialized && this.map) {
            this.map.invalidateSize();
        }
    }
}

// Instância global
export const adminMap = new AdminMap();
export default AdminMap;