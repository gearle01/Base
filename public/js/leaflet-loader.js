// ✅ OTIMIZADO: Carregamento condicional do Leaflet.js
const LeafletLoader = {
    isLoaded: false,
    loadPromise: null,

    async load() {
        if (this.isLoaded) return;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = new Promise(async (resolve, reject) => {
            try {
                // Carrega o CSS do Leaflet
                const leafletCSS = document.createElement('link');
                leafletCSS.rel = 'stylesheet';
                leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
                leafletCSS.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
                leafletCSS.crossOrigin = '';
                document.head.appendChild(leafletCSS);

                // Carrega o JS do Leaflet
                const leafletScript = document.createElement('script');
                leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                leafletScript.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
                leafletScript.crossOrigin = '';

                leafletScript.onload = () => {
                    this.isLoaded = true;
                    console.log('✅ Leaflet carregado com sucesso');
                    resolve();
                };

                leafletScript.onerror = (error) => {
                    console.error('❌ Erro ao carregar Leaflet:', error);
                    reject(error);
                };

                document.head.appendChild(leafletScript);

            } catch (error) {
                console.error('❌ Erro ao carregar Leaflet:', error);
                reject(error);
            }
        });

        return this.loadPromise;
    },

    async initMap(containerId, lat, lng, zoom = 15) {
        if (!document.getElementById(containerId)) {
            throw new Error(`Container ${containerId} não encontrado`);
        }

        await this.load();

        const map = L.map(containerId).setView([lat, lng], zoom);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        const marker = L.marker([lat, lng]).addTo(map);

        return { map, marker };
    },

    updateMarker(lat, lng) {
        // Placeholder for update marker logic if needed, 
        // currently initMap returns the marker instance which can be used directly.
        // But app.js calls LeafletLoader.updateMarker, so we need it.
        // However, we don't store the map/marker instance globally here.
        // app.js should probably manage the marker instance returned by initMap.
        // For now, let's add a dummy or fix app.js. 
        // Actually, looking at app.js, it calls LeafletLoader.updateMarker(lat, lng).
        // We need to store the marker instance.
        if (this.marker) {
            this.marker.setLatLng([lat, lng]);
            if (this.map) this.map.setView([lat, lng]);
        }
    }
};

// Monkey patch initMap to store instance for updateMarker
const originalInitMap = LeafletLoader.initMap;
LeafletLoader.initMap = async function (containerId, lat, lng, zoom) {
    const result = await originalInitMap.call(this, containerId, lat, lng, zoom);
    this.map = result.map;
    this.marker = result.marker;
    return result;
};

export default LeafletLoader;