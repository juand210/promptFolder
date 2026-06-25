/* ==========================================================================
   SourceContextor - Lógica JavaScript (Client-side)
   ========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    // Referencias de Elementos del DOM
    const dropZone = document.getElementById('drop-zone');
    const legacyInput = document.getElementById('folder-input-legacy');
    const btnSelectFolderApi = document.getElementById('btn-select-folder-api');
    const btnCopy = document.getElementById('btn-copy');
    const btnCopyText = document.getElementById('btn-copy-text');
    const btnDownload = document.getElementById('btn-download');
    const outputTextarea = document.getElementById('output-textarea');
    const selectedFolderInfo = document.getElementById('selected-folder-info');
    const currentFolderNameEl = document.getElementById('current-folder-name');
    const copyToast = document.getElementById('copy-toast');
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const themeIconSun = btnThemeToggle.querySelector('.theme-icon-sun');
    const themeIconMoon = btnThemeToggle.querySelector('.theme-icon-moon');

    // Lógica de cambio de tema (Claro / Oscuro)
    function initTheme() {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            themeIconSun.classList.remove('hidden');
            themeIconMoon.classList.add('hidden');
        } else {
            document.body.classList.remove('light-theme');
            themeIconSun.classList.add('hidden');
            themeIconMoon.classList.remove('hidden');
        }
    }

    initTheme();

    btnThemeToggle.addEventListener('click', () => {
        const isLightTheme = document.body.classList.toggle('light-theme');
        if (isLightTheme) {
            localStorage.setItem('theme', 'light');
            themeIconSun.classList.remove('hidden');
            themeIconMoon.classList.add('hidden');
        } else {
            localStorage.setItem('theme', 'dark');
            themeIconSun.classList.add('hidden');
            themeIconMoon.classList.remove('hidden');
        }
    });

    // Estadísticas
    const statFilesEl = document.getElementById('stat-files');
    const statCharsEl = document.getElementById('stat-chars');
    const statTokensEl = document.getElementById('stat-tokens');

    // Checkboxes de Configuración
    const ignoreModulesCb = document.getElementById('ignore-modules');
    const ignoreGitCb = document.getElementById('ignore-git');
    const ignoreVenvCb = document.getElementById('ignore-venv');
    const ignoreBuildsCb = document.getElementById('ignore-builds');
    const ignoreLocksCb = document.getElementById('ignore-locks');
    const ignoreMediaCb = document.getElementById('ignore-media');
    const customIgnoresInput = document.getElementById('custom-ignores');

    // Estado de la aplicación
    let projectFolderName = 'proyecto';
    let processedTextResult = '';

    // ==========================================================================
    // Filtros de Exclusión
    // ==========================================================================

    // Extensiones binarias / multimedia a ignorar
    const BINARY_EXTENSIONS = new Set([
        // Imágenes
        'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff', 'psd', 'ai',
        // Audio y Video
        'mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac',
        // Documentos complejos y comprimidos
        'pdf', 'zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'xz',
        // Fuentes
        'woff', 'woff2', 'eot', 'ttf', 'otf',
        // Ejecutables y compilados
        'exe', 'dll', 'so', 'dylib', 'bin', 'pyc', 'class', 'o', 'obj', 'db', 'sqlite'
    ]);

    // Archivos de bloqueo
    const LOCK_FILES = new Set([
        'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'poetry.lock', 
        'composer.lock', 'cargo.lock', 'mix.lock', 'gemfile.lock'
    ]);

    /**
     * Comprueba si una ruta o archivo debe ignorarse
     * @param {string} relativePath Ruta relativa del archivo o directorio (ej. "src/node_modules/pkg/index.js")
     * @param {boolean} isDirectory Indica si la ruta corresponde a un directorio
     * @returns {boolean} True si debe ser ignorado, False si debe procesarse
     */
    function shouldIgnore(relativePath, isDirectory = false) {
        // Normalizar a minúsculas y usar barras diagonales simples
        const path = relativePath.toLowerCase().replace(/\\/g, '/');
        const parts = path.split('/').filter(p => p.length > 0);
        
        if (parts.length === 0) return false;
        
        const fileName = parts[parts.length - 1];
        const extension = fileName.split('.').pop();

        // 1. Validar Checkbox de node_modules
        if (ignoreModulesCb.checked && parts.includes('node_modules')) {
            return true;
        }

        // 2. Validar Checkbox de .git
        if (ignoreGitCb.checked && (parts.includes('.git') || parts.includes('.github'))) {
            return true;
        }

        // 3. Validar Checkbox de Python (venv, .venv, env)
        if (ignoreVenvCb.checked && (parts.includes('venv') || parts.includes('.venv') || parts.includes('env') || parts.includes('__pycache__'))) {
            return true;
        }

        // 4. Validar Checkbox de Builds (dist, build, .next, .expo, target, out, tmp)
        if (ignoreBuildsCb.checked) {
            const buildDirs = ['dist', 'build', '.next', '.expo', 'target', 'out', 'tmp', '.nuxt', '.cache'];
            if (parts.some(part => buildDirs.includes(part))) {
                return true;
            }
        }

        // 5. Validar Checkbox de Archivos de bloqueo (*-lock.*)
        if (ignoreLocksCb.checked && !isDirectory) {
            if (LOCK_FILES.has(fileName) || fileName.includes('-lock.') || fileName.includes('.lock')) {
                return true;
            }
        }

        // 6. Validar Checkbox de multimedia e imágenes
        if (ignoreMediaCb.checked && !isDirectory) {
            if (BINARY_EXTENSIONS.has(extension)) {
                return true;
            }
        }

        // 7. Filtros personalizados introducidos por el usuario
        const customValue = customIgnoresInput.value.trim();
        if (customValue) {
            const customPatterns = customValue.split(',')
                .map(p => p.trim().toLowerCase())
                .filter(p => p.length > 0);

            for (const pattern of customPatterns) {
                // Si el patrón tiene comodín de extensión como *.log
                if (pattern.startsWith('*.')) {
                    const ext = pattern.substring(2);
                    if (extension === ext) return true;
                }
                // Si el patrón tiene un comodín general de texto
                else if (pattern.includes('*')) {
                    const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
                    try {
                        const regex = new RegExp(regexStr);
                        if (regex.test(fileName) || regex.test(path)) return true;
                    } catch (e) {
                        // Expresión regular inválida, caída hacia include simple
                        if (path.includes(pattern)) return true;
                    }
                }
                // Coincidencia exacta o parcial de directorio/archivo
                else {
                    // Si el patrón termina en barra, p.ej. "temp/"
                    if (pattern.endsWith('/')) {
                        const dirPattern = pattern.slice(0, -1);
                        if (parts.includes(dirPattern)) return true;
                    } else {
                        // Coincidencia exacta con nombre de archivo o parte de la ruta
                        if (fileName === pattern || parts.includes(pattern) || path.includes(pattern)) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    /**
     * Determina si un string tiene caracteres nulos (heurística simple para detectar binarios)
     * @param {string} text Texto a validar
     * @returns {boolean} True si parece binario
     */
    function isLikelyBinary(text) {
        // Comprobar los primeros 8000 caracteres en busca de caracteres de control nulos
        const checkLimit = Math.min(text.length, 8000);
        for (let i = 0; i < checkLimit; i++) {
            if (text.charCodeAt(i) === 0) {
                return true;
            }
        }
        return false;
    }


    // ==========================================================================
    // Recorrido de Directorios (Asíncrono)
    // ==========================================================================

    // Comprobar si File System Access API está disponible
    const isFileSystemAccessApiSupported = typeof window.showDirectoryPicker === 'function';
    if (!isFileSystemAccessApiSupported) {
        // Ocultar botón de API moderna si no es compatible y ajustar el drop text
        btnSelectFolderApi.classList.add('hidden');
        document.querySelector('.drop-text-sub').textContent = "utiliza el botón de abajo para seleccionar tu carpeta";
    }

    // Evento de clic en el botón de la API moderna
    btnSelectFolderApi.addEventListener('click', async () => {
        try {
            const dirHandle = await window.showDirectoryPicker({
                mode: 'read'
            });
            projectFolderName = dirHandle.name;
            showLoadingState();
            
            const files = [];
            await traverseDirectoryHandle(dirHandle, '', files);
            await processFilesList(files);
        } catch (err) {
            console.error('Error al abrir directorio:', err);
            // El usuario canceló la selección o no dio permisos
            if (err.name !== 'AbortError') {
                alert('No se pudo acceder a la carpeta: ' + err.message);
            }
            resetToInitialState();
        }
    });

    // Evento de cambio en el input de carga legacy
    legacyInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        showLoadingState();

        // Extraer el nombre de la carpeta raíz
        const firstFilePath = files[0].webkitRelativePath;
        if (firstFilePath) {
            projectFolderName = firstFilePath.split('/')[0];
        } else {
            projectFolderName = 'proyecto';
        }

        const filteredFiles = [];

        // Filtrar archivos en base a las reglas de exclusión
        for (const file of files) {
            const relativePath = file.webkitRelativePath;
            // Verificar si alguna parte de la ruta del archivo se ignora
            const pathParts = relativePath.split('/');
            // Quitar la carpeta raíz para la evaluación de filtros
            pathParts.shift(); 
            const evaluationPath = pathParts.join('/');
            
            // Verificar directorios intermedios
            let skip = false;
            let currentAccumulatedPath = '';
            for (let i = 0; i < pathParts.length - 1; i++) {
                currentAccumulatedPath += (i > 0 ? '/' : '') + pathParts[i];
                if (shouldIgnore(currentAccumulatedPath, true)) {
                    skip = true;
                    break;
                }
            }

            if (skip) continue;

            // Verificar el archivo en sí
            if (shouldIgnore(evaluationPath, false)) {
                continue;
            }

            filteredFiles.push({
                relativePath: evaluationPath,
                file: file
            });
        }

        await processFilesList(filteredFiles);
        
        // Limpiar el valor del input para permitir subir la misma carpeta de nuevo
        legacyInput.value = '';
    });

    /**
     * Recorre recursivamente un DirectoryHandle usando File System Access API
     */
    async function traverseDirectoryHandle(dirHandle, currentRelativePath, filesAccumulator) {
        for await (const entry of dirHandle.values()) {
            const entryRelativePath = currentRelativePath ? `${currentRelativePath}/${entry.name}` : entry.name;
            
            if (entry.kind === 'directory') {
                if (shouldIgnore(entryRelativePath, true)) {
                    continue;
                }
                await traverseDirectoryHandle(entry, entryRelativePath, filesAccumulator);
            } else if (entry.kind === 'file') {
                if (shouldIgnore(entryRelativePath, false)) {
                    continue;
                }
                try {
                    const file = await entry.getFile();
                    filesAccumulator.push({
                        relativePath: entryRelativePath,
                        file: file
                    });
                } catch (e) {
                    console.warn(`No se pudo leer el archivo ${entryRelativePath}:`, e);
                }
            }
        }
    }


    // ==========================================================================
    // Drag and Drop
    // ==========================================================================

    // Prevenir comportamientos por defecto del navegador en drag/drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Efectos visuales de drag over
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    // Manejar el soltado de la carpeta
    dropZone.addEventListener('drop', async (e) => {
        const dt = e.dataTransfer;
        
        // Intentar usar DataTransferItem para el acceso a directorios (Chrome/Edge/Firefox)
        if (dt.items && dt.items.length > 0) {
            const item = dt.items[0];
            
            if (item.kind === 'file') {
                // Comprobar si el navegador soporta getAsFileSystemHandle (moderno)
                if (typeof item.getAsFileSystemHandle === 'function') {
                    try {
                        const handle = await item.getAsFileSystemHandle();
                        if (handle.kind === 'directory') {
                            projectFolderName = handle.name;
                            showLoadingState();
                            
                            const files = [];
                            await traverseDirectoryHandle(handle, '', files);
                            await processFilesList(files);
                            return;
                        }
                    } catch (err) {
                        console.error('Error al procesar drop con File System API:', err);
                    }
                }
                
                // Fallback webkitGetAsEntry (muy compatible en navegadores web de escritorio)
                if (typeof item.webkitGetAsEntry === 'function') {
                    const entry = item.webkitGetAsEntry();
                    if (entry && entry.isDirectory) {
                        projectFolderName = entry.name;
                        showLoadingState();
                        
                        const files = [];
                        await traverseDirectoryEntry(entry, '', files);
                        await processFilesList(files);
                        return;
                    }
                }
            }
        }
        
        // Mensaje de advertencia si arrastra archivos sueltos en vez de una carpeta
        alert('Por favor, arrastra una CARPETA completa de tu proyecto en lugar de archivos sueltos.');
    });

    /**
     * Recorre recursivamente un FileSystemEntry (para soporte drag and drop estándar)
     */
    function traverseDirectoryEntry(entry, currentRelativePath, filesAccumulator) {
        return new Promise((resolve) => {
            if (entry.isFile) {
                if (shouldIgnore(currentRelativePath, false)) {
                    resolve();
                    return;
                }
                entry.file((file) => {
                    filesAccumulator.push({
                        relativePath: currentRelativePath,
                        file: file
                    });
                    resolve();
                }, (err) => {
                    console.warn('Error al leer archivo del entry:', err);
                    resolve();
                });
            } else if (entry.isDirectory) {
                if (shouldIgnore(currentRelativePath, true)) {
                    resolve();
                    return;
                }
                const dirReader = entry.createReader();
                let allEntries = [];

                // Los lectores de directorios de HTML5 pueden requerir múltiples lecturas
                const readEntries = () => {
                    dirReader.readEntries(async (entries) => {
                        if (entries.length === 0) {
                            // Procesar todas las entradas recolectadas secuencialmente
                            for (const childEntry of allEntries) {
                                const childPath = currentRelativePath ? `${currentRelativePath}/${childEntry.name}` : childEntry.name;
                                await traverseDirectoryEntry(childEntry, childPath, filesAccumulator);
                            }
                            resolve();
                        } else {
                            allEntries = allEntries.concat(entries);
                            readEntries();
                        }
                    }, (err) => {
                        console.warn('Error al leer subdirectorios:', err);
                        resolve();
                    });
                };
                readEntries();
            }
        });
    }


    // ==========================================================================
    // Procesamiento de Contenidos y Salida
    // ==========================================================================

    /**
     * Procesa la lista de archivos recopilados: lee su contenido, construye el árbol y escribe el bloque final
     * @param {Array<{relativePath: string, file: File}>} filesList Lista de objetos de archivos
     */
    async function processFilesList(filesList) {
        if (filesList.length === 0) {
            alert('No se encontraron archivos de código fuente válidos que coincidan con la configuración actual.');
            resetToInitialState();
            return;
        }

        const validFiles = [];
        let totalFilesCounter = 0;

        // Leer el contenido de cada archivo de forma asíncrona
        for (const fileObj of filesList) {
            try {
                const text = await fileObj.file.text();
                
                // Excluir archivos que parezcan binarios analizando el byte nulo en la cabecera
                if (isLikelyBinary(text)) {
                    continue;
                }

                // Omitir archivos extremadamente gigantescos (> 2.5MB) para no sobrecargar el navegador
                if (fileObj.file.size > 2.5 * 1024 * 1024) {
                    console.warn(`Archivo omitido por tamaño excesivo (>2.5MB): ${fileObj.relativePath}`);
                    continue;
                }

                validFiles.push({
                    path: fileObj.relativePath,
                    content: text
                });
                totalFilesCounter++;
            } catch (err) {
                console.warn(`Error al leer archivo ${fileObj.relativePath}:`, err);
            }
        }

        if (validFiles.length === 0) {
            alert('No se encontraron archivos de texto legibles.');
            resetToInitialState();
            return;
        }

        // Ordenar archivos alfabéticamente por ruta para consistencia
        validFiles.sort((a, b) => a.path.localeCompare(b.path));

        // 1. Generar Estructura en Árbol
        const projectTreeText = buildTreeText(validFiles.map(f => f.path));

        // 2. Generar el Bloque de Texto Consolidado
        let output = `================================================================\n`;
        output += `ESTRUCTURA DEL PROYECTO: ${projectFolderName}\n`;
        output += `================================================================\n`;
        output += `${projectTreeText}\n\n`;
        output += `================================================================\n`;
        output += `CONTENIDO DE LOS ARCHIVOS\n`;
        output += `================================================================\n\n`;

        for (const file of validFiles) {
            output += `--- INICIO ARCHIVO: ${file.path} ---\n`;
            output += `${file.content}\n`;
            output += `--- FIN ARCHIVO: ${file.path} ---\n\n`;
        }

        processedTextResult = output;

        // Actualizar UI
        outputTextarea.value = processedTextResult;
        
        // Actualizar estadísticas
        const totalChars = processedTextResult.length;
        const estimatedTokens = Math.round(totalChars / 4);

        statFilesEl.textContent = totalFilesCounter.toLocaleString();
        statCharsEl.textContent = totalChars.toLocaleString();
        statTokensEl.textContent = estimatedTokens.toLocaleString();

        // Mostrar píldora informativa
        currentFolderNameEl.textContent = projectFolderName;
        selectedFolderInfo.classList.remove('hidden');

        // Habilitar botones de acción
        btnCopy.disabled = false;
        btnDownload.disabled = false;
        
        restoreDropZone();
    }


    // ==========================================================================
    // Generador del Árbol de Directorios
    // ==========================================================================

    /**
     * Construye una cadena visual del árbol de directorios a partir de una lista de rutas de archivos
     * @param {Array<string>} filePaths Lista de rutas relativas ordenadas
     * @returns {string} Estructura del árbol visual
     */
    function buildTreeText(filePaths) {
        const root = { name: projectFolderName, children: {}, isDirectory: true };

        // Construir la estructura anidada en memoria
        for (const path of filePaths) {
            const parts = path.split('/');
            let current = root;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isLast = (i === parts.length - 1);

                if (!current.children[part]) {
                    current.children[part] = {
                        name: part,
                        children: {},
                        isDirectory: !isLast
                    };
                }
                current = current.children[part];
            }
        }

        // Renderizar el árbol textual de forma recursiva
        let treeStr = `${root.name}/\n`;
        
        function renderNode(node, prefix = '') {
            const keys = Object.keys(node.children).sort((a, b) => {
                // Poner directorios primero, luego archivos
                const nodeA = node.children[a];
                const nodeB = node.children[b];
                if (nodeA.isDirectory && !nodeB.isDirectory) return -1;
                if (!nodeA.isDirectory && nodeB.isDirectory) return 1;
                return a.localeCompare(b);
            });

            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                const childNode = node.children[key];
                const isLast = (i === keys.length - 1);
                
                const marker = isLast ? '└── ' : '├── ';
                const displayName = childNode.name + (childNode.isDirectory ? '/' : '');
                
                treeStr += `${prefix}${marker}${displayName}\n`;
                
                if (childNode.isDirectory) {
                    const newPrefix = prefix + (isLast ? '    ' : '│   ');
                    renderNode(childNode, newPrefix);
                }
            }
        }

        renderNode(root, '');
        return treeStr;
    }


    // ==========================================================================
    // Acciones de Botones y Estados de UI
    // ==========================================================================

    // Evento Copiar al Portapapeles
    btnCopy.addEventListener('click', async () => {
        if (!processedTextResult) return;
        try {
            await navigator.clipboard.writeText(processedTextResult);
            
            // Feedback Visual Exitoso
            copyToast.classList.remove('hidden');
            btnCopy.classList.remove('btn-success');
            btnCopy.style.backgroundColor = '#065f46'; // Verde oscuro
            btnCopyText.textContent = '¡Copiado con éxito!';
            
            setTimeout(() => {
                copyToast.classList.add('hidden');
                btnCopy.style.backgroundColor = '';
                btnCopy.classList.add('btn-success');
                btnCopyText.textContent = 'Copiar al Portapapeles';
            }, 2500);

        } catch (err) {
            console.error('Error al copiar:', err);
            // Intentar fallback si falla el portapapeles moderno
            try {
                outputTextarea.select();
                document.execCommand('copy');
                alert('Copiado al portapapeles (método alternativo).');
            } catch (e) {
                alert('No se pudo copiar de forma automática. Por favor selecciona el texto del panel inferior y cópialo manualmente.');
            }
        }
    });

    // Evento Descargar como archivo .txt
    btnDownload.addEventListener('click', () => {
        if (!processedTextResult) return;

        try {
            const blob = new Blob([processedTextResult], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            
            // Generar nombre de archivo seguro
            const safeName = projectFolderName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `${safeName}_contexto_proyecto.txt`;

            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            
            // Liberar memoria
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
        } catch (err) {
            alert('Error al generar la descarga: ' + err.message);
        }
    });

    // Control de UI en estado de carga
    function showLoadingState() {
        dropZone.style.pointerEvents = 'none';
        dropZone.style.opacity = '0.7';
        document.querySelector('.drop-text-main').textContent = 'Procesando archivos del proyecto...';
        document.querySelector('.drop-text-sub').textContent = 'Por favor, espera un momento.';
        document.querySelector('.upload-buttons').classList.add('hidden');
        
        btnCopy.disabled = true;
        btnDownload.disabled = true;
    }

    // Restaurar zona de drop
    function restoreDropZone() {
        dropZone.style.pointerEvents = '';
        dropZone.style.opacity = '';
        document.querySelector('.drop-text-main').textContent = 'Arrastra y suelta aquí la carpeta de tu proyecto';
        document.querySelector('.drop-text-sub').textContent = isFileSystemAccessApiSupported 
            ? 'o utiliza uno de los siguientes botones' 
            : 'utiliza el botón de abajo para seleccionar tu carpeta';
        document.querySelector('.upload-buttons').classList.remove('hidden');
    }

    // Volver al estado inicial
    function resetToInitialState() {
        processedTextResult = '';
        outputTextarea.value = '';
        statFilesEl.textContent = '0';
        statCharsEl.textContent = '0';
        statTokensEl.textContent = '0';
        selectedFolderInfo.classList.add('hidden');
        btnCopy.disabled = true;
        btnDownload.disabled = true;
        restoreDropZone();
    }

    // Lógica para comportamiento responsivo del FAQ
    function handleFaqResponsiveness() {
        const faqItems = document.querySelectorAll('.faq-item');
        const isDesktop = window.innerWidth >= 992;

        faqItems.forEach(item => {
            if (isDesktop) {
                item.setAttribute('open', '');
                item.addEventListener('click', preventFaqToggle);
            } else {
                item.removeAttribute('open');
                item.removeEventListener('click', preventFaqToggle);
            }
        });
    }

    function preventFaqToggle(e) {
        e.preventDefault();
    }

    // Inicializar y registrar listeners
    handleFaqResponsiveness();
    window.addEventListener('resize', handleFaqResponsiveness);
});
