// ✅ OTIMIZADO: Virtual DOM simples para renderização eficiente
const VirtualDOM = {
    createElement(type, props = {}, ...children) {
        return {
            type,
            props: { ...props, children: children.flat() }
        };
    },
    
    areEqual(node1, node2) {
        return (
            node1.type === node2.type &&
            JSON.stringify(node1.props) === JSON.stringify(node2.props)
        );
    },
    
    createRealElement(vnode) {
        if (typeof vnode === 'string' || typeof vnode === 'number') {
            return document.createTextNode(vnode);
        }
        
        const element = document.createElement(vnode.type);
        
        // Adiciona propriedades ao elemento
        Object.entries(vnode.props || {}).forEach(([key, value]) => {
            if (key === 'children') return;
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key.startsWith('on') && typeof value === 'function') {
                element.addEventListener(key.toLowerCase().slice(2), value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        // Adiciona filhos recursivamente
        if (vnode.props.children) {
            vnode.props.children
                .map(child => this.createRealElement(child))
                .forEach(child => element.appendChild(child));
        }
        
        return element;
    },
    
    updateElement(parent, newNode, oldNode, index = 0) {
        if (!oldNode) {
            parent.appendChild(this.createRealElement(newNode));
        } else if (!newNode) {
            parent.removeChild(parent.childNodes[index]);
        } else if (this.areEqual(newNode, oldNode)) {
            // Nós são iguais, não precisa atualizar
            return;
        } else if (newNode.type !== oldNode.type) {
            parent.replaceChild(
                this.createRealElement(newNode),
                parent.childNodes[index]
            );
        } else {
            // Atualiza propriedades
            const el = parent.childNodes[index];
            Object.entries(newNode.props || {}).forEach(([key, value]) => {
                if (key === 'children') return;
                if (key === 'className') {
                    el.className = value;
                } else if (key === 'style' && typeof value === 'object') {
                    Object.assign(el.style, value);
                } else {
                    el.setAttribute(key, value);
                }
            });
            
            // Atualiza filhos recursivamente
            const maxLength = Math.max(
                newNode.props.children.length,
                oldNode.props.children.length
            );
            
            for (let i = 0; i < maxLength; i++) {
                this.updateElement(
                    el,
                    newNode.props.children[i],
                    oldNode.props.children[i],
                    i
                );
            }
        }
    }
};