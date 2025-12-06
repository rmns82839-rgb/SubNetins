/**
 * Lógica principal para la calculadora de Subnetting IP (CLSM y VLSM),
 * con persistencia de datos usando localStorage.
 * * CORRECCIÓN: Se eliminan las llamadas inline del HTML (oninput/onclick) 
 * y se delega el manejo de eventos a este script para evitar 'ReferenceError'.
 */

// ====================================================================
// CONFIGURACIÓN DE LOCAL STORAGE (PERSISTENCIA DE DATOS)
// ====================================================================
const LOCAL_STORAGE_KEY = 'subnettingAppData';

/**
 * Guarda el estado actual de los inputs y los resultados en localStorage.
 */
function saveInputState() {
    try {
        const ipAddress = document.getElementById('ip-address').value;
        const cidr = document.getElementById('cidr').value;
        const clsmSubnets = document.getElementById('clsm-subnets').value;
        const checkedRadio = document.querySelector('input[name="calculation-type"]:checked');
        const calculationType = checkedRadio ? checkedRadio.value : 'clsm';
        
        const reportName = document.getElementById('report-name') ? document.getElementById('report-name').value : ''; 

        // Capturar los requisitos de hosts VLSM, incluyendo el placeholder
        const vlsmRequirements = Array.from(document.querySelectorAll('#host-requirements-list .vlsm-host-input'))
                                    .map(input => ({ 
                                        value: input.value, 
                                        placeholder: input.placeholder, 
                                        datasetOriginalIndex: input.parentElement.dataset.originalIndex 
                                    }));

        const resultsHTML = document.getElementById('results-output').innerHTML;
        const stepsHTML = document.getElementById('step-by-step-output').innerHTML;

        const dataToSave = {
            ipAddress,
            cidr,
            clsmSubnets,
            calculationType,
            vlsmRequirements,
            resultsHTML,
            stepsHTML,
            reportName 
        };

        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
        console.error("Error al guardar el estado en localStorage:", error);
    }
}

/**
 * Carga el estado guardado desde localStorage y restaura la UI.
 */
function loadInputState() {
    try {
        const storedData = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!storedData) {
            return;
        }

        const data = JSON.parse(storedData);
        
        document.getElementById('ip-address').value = data.ipAddress || '';
        document.getElementById('cidr').value = data.cidr || 24;
        document.getElementById('clsm-subnets').value = data.clsmSubnets || '';
        
        if (document.getElementById('report-name')) {
            document.getElementById('report-name').value = data.reportName || '';
        }
        
        const typeInput = document.getElementById(data.calculationType);
        if (typeInput) {
            typeInput.checked = true;
            toggleCLSMInputs(data.calculationType === 'clsm');
        } else {
            document.getElementById('clsm').checked = true;
            toggleCLSMInputs(true);
        }

        const hostList = document.getElementById('host-requirements-list');
        // Limpiar inputs de hosts existentes antes de cargar
        hostList.innerHTML = '';
        
        if (data.vlsmRequirements && data.vlsmRequirements.length > 0) {
            data.vlsmRequirements.forEach((req) => {
                // Llama a la función addHostInput con los valores cargados
                addHostInput(req.value || '', req.placeholder || `Hosts para Subred 1`);
            });
        } else {
             // Si no hay requisitos guardados, el DOMContentLoaded creará el primero.
        }

        document.getElementById('results-output').innerHTML = data.resultsHTML || '<p>Ingrese los datos y presione "CALCULAR SUBREDES" para ver los resultados.</p>';
        document.getElementById('step-by-step-output').innerHTML = data.stepsHTML || '<p>El proceso detallado de la segmentación se mostrará aquí.</p>';
        
        if (window.MathJax) {
            window.MathJax.typesetPromise();
        }
        
        // Mostrar el campo de nombre del analista si hay resultados cargados
        const resultsDiv = document.getElementById('results-output');
        if (data.resultsHTML && !data.resultsHTML.includes('Ingrese los datos')) {
            document.getElementById('print-report-name-group').style.display = 'block';
        }

    } catch (error) {
        console.error("Error al cargar el estado desde localStorage:", error);
    }
}

/**
 * Borra el estado guardado en localStorage y refresca la página.
 */
function clearAll() {
    if (!window.confirm('¿Estás seguro de que quieres borrar todos los datos guardados localmente y recargar la página?')) {
        return;
    }
    
    try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
        window.location.reload(); 
    } catch (error) {
        console.error("Error al eliminar el estado de localStorage:", error);
        window.location.reload();
    }
}

/**
 * Calcula 2 elevado a la 'n' y muestra el resultado en la UI.
 */
function calculateExponent() {
    const inputElement = document.getElementById('exponent-input');
    const outputElement = document.getElementById('exponent-output');
    const n = parseInt(inputElement.value, 10);

    if (isNaN(n) || n < 0 || n > 31) {
        outputElement.innerHTML = `<span class="error-message">Por favor, ingrese un número entre 0 y 31.</span>`;
        return;
    }

    const result = Math.pow(2, n);
    const resultString = result.toLocaleString('es-ES');
    
    outputElement.innerHTML = `$$2^{${n}} = ${resultString}$$`;
    
    if (window.MathJax) {
        window.MathJax.typesetPromise([outputElement]).catch(err => console.log('MathJax error in exponent:', err));
    }
}

/**
 * [Resto de las funciones de cálculo (formatBinaryStep, validateInput, cidrToMask, etc.)]
 * [Se asume que estas funciones internas están correctamente definidas aquí]
 */
function formatBinaryStep(ipInt, startCidr, newCidr, type) {
    let binary32 = (ipInt >>> 0).toString(2).padStart(32, '0');
    let html = '';

    for (let i = 0; i < 4; i++) {
        const octet = binary32.substring(i * 8, (i + 1) * 8);
        let octetHtml = '';

        for (let j = 0; j < 8; j++) {
            const bitIndex = i * 8 + j + 1;
            const bit = octet[j];
            let className = 'bit-zero';

            if (type === 'mask') {
                className = bitIndex <= newCidr ? 'bit-one' : 'bit-zero';
            } else { 
                if (bitIndex <= newCidr) {
                    if (bitIndex <= startCidr) {
                        className = 'bit-one'; 
                    } else {
                        className = 'bit-subnet'; 
                    }
                } else {
                    if (type === 'broadcast') {
                        className = 'bit-one'; 
                    } else {
                        className = 'bit-zero';
                    }
                }
                
                 if (bit === '0' && className !== 'bit-zero') {
                    className = 'bit-zero'; 
                }
            }
            
            if (bit === '1') {
                 if (type === 'mask' && bitIndex <= newCidr) {
                    className = 'bit-one'; 
                 } else if (type !== 'mask') {
                    if (bitIndex <= startCidr) {
                        className = 'bit-one';
                    } else if (bitIndex <= newCidr) {
                        className = 'bit-subnet';
                    } else if (type === 'broadcast') {
                        className = 'bit-one';
                    }
                 }
            }

            octetHtml += `<span class="${className}">${bit}</span>`;
        }

        html += `<div class="octet-group">${octetHtml}</div>`;
    }
    return html;
}

function validateInput(ipAddress, cidr) {
    const octets = ipAddress.split('.').map(Number);
    if (octets.length !== 4 || octets.some(o => isNaN(o) || o < 0 || o > 255)) {
        return { isValid: false, message: "La dirección IP es inválida.", ipOctets: [] };
    }
    if (isNaN(cidr) || cidr < 0 || cidr > 32) {
        return { isValid: false, message: "El CIDR es inválido (debe estar entre 0 y 32).", ipOctets: [] };
    }
    return { isValid: true, message: "", ipOctets: octets };
}

function cidrToMask(cidr) {
    let mask = [];
    let tempCidr = cidr;
    for (let i = 0; i < 4; i++) {
        let octet = 0;
        for (let j = 0; j < 8; j++) {
            if (tempCidr > 0) {
                octet += Math.pow(2, 7 - j);
                tempCidr--;
            }
        }
        mask.push(octet);
    }
    return mask.join('.');
}

function ipOctetsToInt(ipOctets) {
    return (ipOctets[0] << 24) + (ipOctets[1] << 16) + (ipOctets[2] << 8) + ipOctets[3];
}

function ipIntToDotDecimal(ipInt) {
     return [
        (ipInt >>> 24) & 0xFF,
        (ipInt >>> 16) & 0xFF,
        (ipInt >>> 8) & 0xFF,
        ipInt & 0xFF
    ].join('.');
}

function calculateSubnetting() {
    const ipAddress = document.getElementById('ip-address').value.trim();
    const cidr = parseInt(document.getElementById('cidr').value, 10);
    const calculationType = document.querySelector('input[name="calculation-type"]:checked').value;
    const resultsDiv = document.getElementById('results-output');
    const stepsDiv = document.getElementById('step-by-step-output');
    
    resultsDiv.innerHTML = '';
    stepsDiv.innerHTML = '';

    const validation = validateInput(ipAddress, cidr);
    if (!validation.isValid) {
        resultsDiv.innerHTML = `<p class="error-message">${validation.message}</p>`;
        saveInputState();
        document.getElementById('print-report-name-group').style.display = 'none'; 
        return;
    }

    const ipOctets = validation.ipOctets;
    const steps = [];
    let subnets = [];
    
    const initialMaskInt = (0xFFFFFFFF << (32 - cidr)) >>> 0;
    let currentIpInt = ipOctetsToInt(ipOctets);
    const networkStartInt = currentIpInt & initialMaskInt;
    currentIpInt = networkStartInt;

    steps.push({
        title: "Paso 1: Validación y Parámetros Iniciales",
        content: `Dirección IP: \`${ipAddress}\`. Prefijo CIDR Inicial: \`/${cidr}\`. Tipo de Cálculo: ${calculationType.toUpperCase()}.`,
        math: null
    });
    
    // CLSM (Máscara de Subred Fija)
    if (calculationType === 'clsm') {
        const requiredSubnetsInput = document.getElementById('clsm-subnets').value;
        const requiredSubnets = parseInt(requiredSubnetsInput, 10);

        if (isNaN(requiredSubnets) || requiredSubnets < 2) {
            resultsDiv.innerHTML = `<p class="error-message">Para CLSM, ingrese un número de subredes mayor o igual a 2.</p>`;
            saveInputState();
            document.getElementById('print-report-name-group').style.display = 'none';
            return;
        }

        let bitsNeeded = 0;
        while (Math.pow(2, bitsNeeded) < requiredSubnets) {
            bitsNeeded++;
        }
        const totalSubnets = Math.pow(2, bitsNeeded);
        const newCidr = cidr + bitsNeeded;

        if (newCidr > 30) { 
            resultsDiv.innerHTML = `<p class="error-message">No es posible segmentar. Se requiere un CIDR /${newCidr}, excediendo el límite usable de /30 para tener hosts usables (direcciones > 2).</p>`;
            saveInputState();
            document.getElementById('print-report-name-group').style.display = 'none';
            return;
        }
        
        const hostBits = 32 - newCidr;
        const totalHostsPerSubnet = Math.pow(2, hostBits);
        const usableHostsPerSubnet = totalHostsPerSubnet - 2;
        const newMask = cidrToMask(newCidr);
        const newMaskInt = (0xFFFFFFFF << (32 - newCidr)) >>> 0;
        
        const initialIpInt = ipOctetsToInt(ipOctets);
        steps.push({
            title: "Paso 2: Bits de Subred y Nueva Máscara",
            content: `Se necesitan ${requiredSubnets} subredes. Se busca 'n' tal que $2^n \\ge ${requiredSubnets}$.`,
            math: `\\{Bits de Subred (n)} = ${bitsNeeded} 2^{${bitsNeeded}} = ${totalSubnets})`,
            details: `Nuevo CIDR: $/${newCidr}$. Máscara: ${newMask}.`
        });
        steps.push({
            title: "Paso 3: Hosts por Subred y Salto de Bloque",
            content: `Se calcula el total de direcciones con ${hostBits} bits de host.`,
            math: `\\{Total Direcciones} = 2^{${hostBits}} = ${totalHostsPerSubnet} \\\\tex{Hosts Usables} = ${usableHostsPerSubnet}`,
            details: `Tamaño del salto (Bloque): ${totalHostsPerSubnet} direcciones.`
        });

        steps.push({
            title: "Paso 4: Cálculo Binario de la Primera Subred",
            content: `Se realiza el *AND* lógico entre la IP base y la Nueva Máscara /${newCidr} para obtener el ID de Red inicial.`,
            math: null,
            binary: {
                cidr: newCidr,
                startCidr: cidr,
                lines: [
                    { label: "IP Base", value: initialIpInt, type: 'red' },
                    { label: "Máscara", value: newMaskInt, type: 'mask', operation: '&' },
                    { label: "ID de Red", value: networkStartInt, type: 'red' }
                ]
            }
        });

        for (let i = 0; i < requiredSubnets; i++) {
            const networkInt = currentIpInt;
            const broadcastInt = networkInt + totalHostsPerSubnet - 1;
            
            if (networkInt > 0xFFFFFFFF) break;

            const networkId = ipIntToDotDecimal(networkInt);
            const broadcastId = ipIntToDotDecimal(broadcastInt);
            const firstHost = ipIntToDotDecimal(networkInt + 1);
            const lastHost = ipIntToDotDecimal(broadcastInt - 1);

            subnets.push({
                name: `Subred ${i + 1}`,
                cidr: newCidr,
                mask: newMask,
                networkId: networkId,
                firstHost: firstHost,
                lastHost: lastHost,
                broadcastId: broadcastId,
                hostsUsable: usableHostsPerSubnet
            });

            currentIpInt += totalHostsPerSubnet;

            steps.push({
                title: `Subred ${i + 1}: Detalle de Direcciones`,
                content: ` Red: ${networkId} (Salto de ${totalHostsPerSubnet} direcciones).`,
                math: null,
                binary: {
                    cidr: newCidr,
                    startCidr: cidr,
                    lines: [
                        { label: "ID Red", value: networkInt, type: 'red' },
                        { label: "1er Host", value: networkInt + 1, type: 'red' },
                        { label: "Últ Host", value: broadcastInt - 1, type: 'red' },
                        { label: "Broadcast", value: broadcastInt, type: 'broadcast' }
                    ]
                }
            });

            if (currentIpInt > 0xFFFFFFFF) break;
        }

    } 
    
    // VLSM (Máscara de Subred Variable)
    else if (calculationType === 'vlsm') {
        const hostRequirements = Array.from(document.querySelectorAll('#host-requirements-list .vlsm-host-input'))
                                    .map(input => ({ name: input.placeholder, hosts: parseInt(input.value, 10), originalIndex: input.dataset.originalIndex }))
                                    .filter(req => !isNaN(req.hosts) && req.hosts > 0);
        
        if (hostRequirements.length === 0) {
             resultsDiv.innerHTML = `<p class="error-message">Para VLSM, ingrese al menos un requisito de Hosts válido.</p>`;
             saveInputState();
             document.getElementById('print-report-name-group').style.display = 'none';
             return;
        }

        hostRequirements.sort((a, b) => b.hosts - a.hosts);

        steps.push({
            title: "Paso 2: Ordenamiento y Requisitos",
            content: `Se ordenan los requisitos de hosts de mayor a menor para optimizar el espacio.`,
            details: `Requisitos Ordenados: ${hostRequirements.map(h => `${h.name} (${h.hosts} Hosts)`).join(', ')}`
        });

        let currentNetworkInt = networkStartInt;
        
        hostRequirements.forEach((req, index) => {
            const requiredHosts = req.hosts;
            const name = req.name;

            let totalAddresses = 0;
            let hostBits = 0;
            while (totalAddresses < requiredHosts + 2) {
                hostBits++;
                totalAddresses = Math.pow(2, hostBits);
            }
            
            const newCidr = 32 - hostBits;
            const newMask = cidrToMask(newCidr);
            const usableHosts = totalAddresses - 2;
            
            const networkInt = currentNetworkInt;
            const broadcastInt = networkInt + totalAddresses - 1;
            
            if (broadcastInt > 0xFFFFFFFF || newCidr < cidr) {
                steps.push({
                     title: `Advertencia: Subred ${index + 1} (${name}) - No Asignada`,
                     content: `No se pudo asignar la subred. El rango excede el límite de la dirección IP o el CIDR requerido (${newCidr}) es menor al inicial (${cidr}).`,
                     math: null,
                     details: 'El espacio de direcciones IP inicial ha sido agotado o el requisito es incompatible.'
                });
                return; 
            }

            const networkId = ipIntToDotDecimal(networkInt);
            const broadcastId = ipIntToDotDecimal(broadcastInt);
            const firstHost = ipIntToDotDecimal(networkInt + 1);
            const lastHost = ipIntToDotDecimal(broadcastInt - 1);

            subnets.push({
                name: name,
                cidr: newCidr,
                mask: newMask,
                networkId: networkId,
                firstHost: firstHost,
                lastHost: lastHost,
                broadcastId: broadcastId,
                hostsUsable: usableHosts,
                requiredHosts: requiredHosts
            });
            
            currentNetworkInt = broadcastInt + 1;
            
            steps.push({
                title: `Paso ${index + 3}: Cálculo para ${name} (${requiredHosts} Hosts)`,
                content: `Se necesita un bloque que soporte ${requiredHosts} hosts. Esto requiere ${hostBits} bits de host.`,
                math: `Bits de Host = ${hostBits} \\ porque: 2^${hostBits} = ${totalAddresses}  direcciones)`,
                details: `Nuevo CIDR: $/${newCidr}$. Hosts Usables: ${usableHosts}. ID de Red Asignado: ${networkId}.`
            });

            steps.push({
                title: `${name}: Detalle Binario`,
                content: `Visualización del bloque de direcciones asignado:`,
                math: null,
                binary: {
                    cidr: newCidr,
                    startCidr: cidr,
                    lines: [
                        { label: "ID Red", value: networkInt, type: 'red' },
                        { label: "Máscara", value: (0xFFFFFFFF << (32 - newCidr)) >>> 0, type: 'mask' },
                        { label: "Broadcast", value: broadcastInt, type: 'broadcast' }
                    ]
                }
            });
        });

    } else {
         resultsDiv.innerHTML = `<p class="error-message">Tipo de cálculo no soportado.</p>`;
         document.getElementById('print-report-name-group').style.display = 'none';
         return;
    }

    renderSteps(steps);
    renderResultsTable(subnets, calculationType);
    saveInputState();
    document.getElementById('print-report-name-group').style.display = 'block';
}


function printReport() {
    const resultsDiv = document.getElementById('results-output');
    const reportNameInput = document.getElementById('report-name');
    const reportName = reportNameInput ? reportNameInput.value.trim() : 'Analista Desconocido';
    
    if (resultsDiv.textContent.includes('Ingrese los datos') || resultsDiv.textContent.trim() === '') {
        alert('Debe calcular las subredes antes de imprimir el reporte.');
        return;
    }

    const printHeaderHTML = `
        <div id="print-header-content" class="print-header">
            <h1 style="font-size: 24px; margin: 0; color: #000;">Reporte de Subnetting IP</h1>
            <p style="margin: 5px 0 0 0; color: #333;">Generado por: <strong>${reportName || 'Analista Desconocido'}</strong></p>
            <p style="margin: 0; font-size: 12px; color: #666;">Fecha de Impresión: ${new Date().toLocaleDateString('es-ES')}</p>
        </div>
    `;
    
    const mainContainer = document.querySelector('.container');
    const headerContainer = document.createElement('div');
    headerContainer.innerHTML = printHeaderHTML;
    
    // Inserta el encabezado temporalmente para la impresión
    mainContainer.prepend(headerContainer.firstChild); 
    
    window.print();

    // Elimina el encabezado después de la impresión
    setTimeout(() => {
        const tempHeader = document.getElementById('print-header-content');
        if (tempHeader) {
            tempHeader.remove();
        }
    }, 500); 
}

function renderSteps(steps) {
    const stepsDiv = document.getElementById('step-by-step-output');
    let html = '<div class="step-list">';
    
    steps.forEach((step, index) => {
        let binaryHtml = '';
        if (step.binary) {
            binaryHtml = '<div class="step-binary">';
            step.binary.lines.forEach(line => {
                const operation = line.operation ? `<span class="binary-operation">${line.operation}</span>` : '';
                binaryHtml += `
                    <div class="step-binary-row">
                        <span class="binary-label">${line.label}:</span>
                        ${operation}
                        <div class="binary-representation">
                            ${formatBinaryStep(line.value, step.binary.startCidr, step.binary.cidr, line.type)}
                        </div>
                        <span class="binary-label dot-decimal-ip">(${ipIntToDotDecimal(line.value)})</span>
                    </div>
                `;
            });
            binaryHtml += '</div>';
        }

        let mathHtml = step.math ? `<div class="step-math">${step.math}</div>` : '';
        let detailsHtml = step.details ? `<p class="step-details">${step.details}</p>` : '';

        const accordionOpenClass = index === 0 ? ' open' : '';
        
        html += `
            <div class="step-card">
                <div class="accordion-header${accordionOpenClass}">
                    <div class="step-number">${index + 1}</div>
                    <h3 class="step-title">${step.title}</h3>
                    <div class="accordion-icon${accordionOpenClass}">▶</div>
                </div>
                <div class="accordion-content${accordionOpenClass}">
                    <p>${step.content}</p>
                    ${mathHtml}
                    ${binaryHtml}
                    ${detailsHtml}
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    stepsDiv.innerHTML = html;
    
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', function() {
            this.classList.toggle('open');
            const content = this.nextElementSibling;
            const icon = this.querySelector('.accordion-icon');
            
            if (content.classList.contains('open')) {
                content.style.maxHeight = null;
                content.classList.remove('open');
                icon.classList.remove('open');
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
                content.classList.add('open');
                icon.classList.add('open');
            }
            
            if (window.MathJax && content.classList.contains('open')) {
                window.MathJax.typesetPromise([content]).catch(err => console.log('MathJax error on accordion open:', err));
            }
        });
    });

    const firstContent = document.querySelector('.step-card .accordion-content');
    const firstIcon = document.querySelector('.step-card .accordion-icon');
    if (firstContent) {
        firstContent.classList.add('open');
        firstIcon.classList.add('open');
        firstContent.style.maxHeight = firstContent.scrollHeight + "px";
    }

    if (window.MathJax) {
        window.MathJax.typesetPromise([stepsDiv]).catch(err => console.log('MathJax error in renderSteps:', err));
    }
}

function renderResultsTable(subnets, calculationType) {
    const resultsDiv = document.getElementById('results-output');
    let tableHTML = `
        <div class="results-table-container">
            <table class="results-table">
                <thead>
                    <tr>
                        <th>Subred</th>
                        <th>Máscara</th>
                        <th>ID de Red</th>
                        <th>1er Host Usable</th>
                        <th>Último Host Usable</th>
                        <th>Broadcast</th>
                        <th>Hosts Usables ($2^n$-2)</th>
                        ${calculationType === 'vlsm' ? '<th>Hosts Requeridos</th>' : ''}
                    </tr>
                </thead>
                <tbody>
    `;

    subnets.forEach(subnet => {
        const hostsUsableHtml = `<span class="hosts-usable-value">${subnet.hostsUsable.toLocaleString('es-ES')}</span>`;
        const hostsRequiredHtml = subnet.requiredHosts ? `<td><span class="hosts-required-value">${subnet.requiredHosts.toLocaleString('es-ES')}</span></td>` : '';
        
        tableHTML += `
            <tr>
                <td>${subnet.name} /${subnet.cidr}</td>
                <td>${subnet.mask}</td>
                <td>${subnet.networkId}</td>
                <td>${subnet.firstHost}</td>
                <td>${subnet.lastHost}</td>
                <td>${subnet.broadcastId}</td>
                <td>${hostsUsableHtml}</td>
                ${hostsRequiredHtml}
            </tr>
        `;
    });

    tableHTML += `
                </tbody>
            </table>
        </div>
    `;
    resultsDiv.innerHTML = tableHTML;
}

/**
 * Alterna la visibilidad de los controles CLSM y VLSM.
 */
function toggleCLSMInputs(isCLSM) {
    document.getElementById('clsm-controls').style.display = isCLSM ? 'block' : 'none';
    document.getElementById('vlsm-controls').style.display = isCLSM ? 'none' : 'block';
}

/**
 * Añade dinámicamente un campo para ingresar los requisitos de host VLSM.
 * El evento oninput se asigna AQUÍ (dentro de la función) porque el elemento es dinámico.
 */
function addHostInput(initialValue = '', placeholderText = null) {
    const list = document.getElementById('host-requirements-list');
    const newIndex = list.children.length + 1;
    
    const group = document.createElement('div');
    group.className = 'vlsm-input-group';
    group.dataset.originalIndex = newIndex;
    
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'vlsm-host-input';
    input.min = '1';
    input.placeholder = placeholderText || `Hosts para Subred ${newIndex}`;
    input.value = initialValue;
    
    // Asignar el event listener para persistencia al input dinámico
    input.addEventListener('input', saveInputState); 

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn remove-host-btn';
    removeBtn.textContent = '–';
    // Asignar el event listener para eliminar
    removeBtn.addEventListener('click', function() { removeHostInput(group); });

    group.appendChild(input);
    group.appendChild(removeBtn);
    list.appendChild(group);
    
    saveInputState();
}

/**
 * Elimina un campo de requisito de host.
 */
function removeHostInput(group) {
    const list = document.getElementById('host-requirements-list');
    const msgElement = document.getElementById('vlsm-error-message');
    msgElement.textContent = ''; 

    if (list.children.length > 1) {
        group.remove();
        saveInputState();
    } else {
        msgElement.textContent = 'Debe haber al menos un requisito de Host.';
        setTimeout(() => msgElement.textContent = '', 3000);
    }
}

// ====================================================================
// INICIALIZACIÓN DE LA APLICACIÓN Y ASIGNACIÓN DE EVENTOS (SOLUCIÓN FINAL)
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. Cargar el estado guardado desde localStorage
    loadInputState();
    
    // 2. Asegurar que CLSM esté activo y haya un input VLSM inicial
    const clsmRadio = document.getElementById('clsm');
    if (!document.querySelector('input[name="calculation-type"]:checked')) {
         clsmRadio.checked = true;
    }
    const hostList = document.getElementById('host-requirements-list');
    if (hostList.children.length === 0) {
         addHostInput('', `Hosts para Subred 1`);
    }

    // Aplicar la visibilidad CLSM/VLSM
    toggleCLSMInputs(clsmRadio.checked);
    
    // 3. ASIGNAR TODOS LOS EVENT LISTENERS (SOLUCIÓN A LOS ReferenceError)
    
    // Inputs de Persistencia (ip-address, cidr, clsm-subnets, report-name)
    document.getElementById('ip-address').addEventListener('input', saveInputState);
    document.getElementById('cidr').addEventListener('input', saveInputState);
    document.getElementById('clsm-subnets').addEventListener('input', saveInputState);
    
    const reportNameInput = document.getElementById('report-name');
    if (reportNameInput) reportNameInput.addEventListener('input', saveInputState);

    // Radio Buttons (Control de CLSM/VLSM y Persistencia)
    document.getElementById('clsm').addEventListener('change', () => {
        toggleCLSMInputs(true);
        saveInputState();
    });
    document.getElementById('vlsm').addEventListener('change', () => {
        toggleCLSMInputs(false);
        saveInputState();
    });
    
    // Botones de Acción
    document.getElementById('calculate-btn').addEventListener('click', calculateSubnetting);
    document.getElementById('clear-btn').addEventListener('click', clearAll);
    document.getElementById('print-btn').addEventListener('click', printReport);
    
    // Botón AÑADIR REQUISITO (SOLUCIÓN DIRECTA al error 'addHostInput is not defined')
    const addHostBtn = document.getElementById('add-host-btn');
    if (addHostBtn) {
         addHostBtn.addEventListener('click', () => addHostInput());
    }

    // Utilidad 2^n
    const calcExponentBtn = document.getElementById('calc-exponent-btn');
    const exponentInput = document.getElementById('exponent-input');
    if (calcExponentBtn) {
        calcExponentBtn.addEventListener('click', calculateExponent);
    }
    if (exponentInput) {
        exponentInput.addEventListener('input', calculateExponent);
    }
    
    // 4. Calcular exponente inicial
    calculateExponent();
});
