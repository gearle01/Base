(function() {
  const VITALS_VERSION = '3.5.2'; // Versão mais recente para melhores métricas

  /**
   * Carrega o script do web-vitals de forma assíncrona.
   */
  function loadVitalsScript() {
    // Evita carregar o script múltiplas vezes
    if (window.webVitals) {
      return;
    }
    const script = document.createElement('script');
    script.src = `https://unpkg.com/web-vitals@${VITALS_VERSION}/dist/web-vitals.iife.js`;
    script.defer = true;
    script.onload = () => {
      console.log('Web Vitals script carregado.');
      // Garante que a instrumentação ocorra após o carregamento do script
      instrumentVitals(); 
    };
    script.onerror = () => console.error('Falha ao carregar o script do Web Vitals.');
    document.head.appendChild(script);
  }

  /**
   * Envia as métricas para o console ou Firebase Analytics.
   * @param {object} metric - O objeto da métrica (e.g., {name, value, id}).
   */
  function sendToAnalytics(metric) {
    const { name, value, id } = metric;
    
    // Define se o ambiente é de produção
    const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

    if (isProduction) {
      // Verifica se o Firebase Analytics está disponível
      if (window.firebase && typeof window.firebase.analytics === 'function') {
        try {
          window.firebase.analytics().logEvent('web_vitals', {
            event_category: 'Web Vitals',
            event_label: id, // Usa o ID único da métrica para melhor granularidade
            metric_name: name, // Nome da métrica (LCP, FID, etc.)
            // Arredonda o valor para um inteiro. Para CLS, multiplicamos por 1000.
            value: Math.round(name === 'CLS' ? value * 1000 : value), 
            non_interaction: true, // Evita que afete a taxa de rejeição
          });
          console.log(`[Web Vitals] Métrica de produção enviada para o Firebase: ${name}`, value);
        } catch (error) {
          console.error('Erro ao enviar métrica para o Firebase Analytics:', error);
        }
      } else {
        console.warn('Firebase Analytics não está disponível. Métrica não enviada:', name, value);
      }
    } else {
      // Log detalhado para ambiente de desenvolvimento
      console.log(`[Web Vitals - Dev] ${name}:`, {
        value: value,
        id: id,
        // Adiciona contexto sobre o que a métrica significa
        description: getMetricDescription(name)
      });
    }
  }

  /**
   * Retorna uma breve descrição da métrica.
   * @param {string} name - O nome da métrica.
   * @returns {string} A descrição.
   */
  function getMetricDescription(name) {
    switch(name) {
      case 'LCP': return 'Largest Contentful Paint: Tempo para renderizar o maior elemento visível.';
      case 'FID': return 'First Input Delay: Tempo de resposta à primeira interação do usuário.';
      case 'CLS': return 'Cumulative Layout Shift: Medida da instabilidade visual da página.';
      case 'FCP': return 'First Contentful Paint: Tempo para renderizar o primeiro conteúdo (texto, imagem, etc.).';
      case 'TTFB': return 'Time to First Byte: Tempo de espera pelo primeiro byte de resposta do servidor.';
      default: return 'Métrica desconhecida.';
    }
  }

  /**
   * Inicializa os observadores para cada métrica do Web Vitals.
   */
  function instrumentVitals() {
    // Garante que o script web-vitals foi carregado
    if (typeof webVitals !== 'undefined') {
      const { getLCP, getFID, getCLS, getTTFB, getFCP } = webVitals;
      
      // Registra callbacks para cada métrica
      getCLS(sendToAnalytics);
      getFID(sendToAnalytics);
      getLCP(sendToAnalytics);
      getFCP(sendToAnalytics);
      getTTFB(sendToAnalytics);
    } else {
      console.warn('O objeto "webVitals" não foi encontrado. A instrumentação falhou.');
    }
  }

  // Inicia o processo quando a página termina de carregar
  window.addEventListener('load', loadVitalsScript);

})();