class SceneManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.transformControls = null;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        this.objects = [];
        this.selectedObject = null;
        this.ground = null;
        this.grid = null;
        this.importedObjects = [];
        
        this.currentTool = 'translate';
        this.snapEnabled = false;
        this.gridVisible = true;
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        this.textureTiling = {
            repeatU: 1,
            repeatV: 1
        };
        
        this.activeTexture = null;
        this.textureSize = 256; // الحجم الافتراضي للخامة
        
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        
        this.loadingManager = new THREE.LoadingManager();
        this.gltfLoader = new THREE.GLTFLoader();
        this.dracoLoader = new THREE.DRACOLoader();
        this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        this.gltfLoader.setDRACOLoader(this.dracoLoader);
        
        // إضافة OBJLoader
        this.objLoader = null;
        
        this.touchStartPos = new THREE.Vector2();
        this.touchEndPos = new THREE.Vector2();
        this.lastTapTime = 0;
        this.touchMoveThreshold = 10;
        
        this.exporter = null;
        this.externalGLTFExporter = null;
        this.objExporter = null;
        
        this.textures = new Map();
        
        this.init();
    }
    
    init() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        this.camera = new THREE.PerspectiveCamera(
            75,
            this.container.clientWidth / this.container.clientHeight,
            0.1,
            1000
        );
        this.camera.position.set(20, 15, 20);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.minDistance = 5;
        this.controls.maxDistance = 100;
        
        if (this.isTouchDevice) {
            this.controls.enablePan = true;
            this.controls.touches = {
                ONE: THREE.TOUCH.ROTATE,
                TWO: THREE.TOUCH.DOLLY_PAN
            };
        }
        
        this.transformControls = new THREE.TransformControls(this.camera, this.renderer.domElement);
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.controls.enabled = !event.value;
        });
        
        this.transformControls.addEventListener('change', () => {
            if (this.selectedObject) {
                this.updateObjectInfo();
            }
        });
        
        this.transformControls.addEventListener('mouseUp', () => {
            this.saveHistoryState();
        });
        
        this.scene.add(this.transformControls);
        this.transformControls.visible = false;
        
        this.setupLights();
        this.createGround();
        this.createGrid();
        
        // تهيئة المصدرين
        this.initializeExporters();
        
        this.setupEventListeners();
        this.animate();
        this.startMemoryMonitoring();
        this.saveHistoryState();
    }
    
    initializeExporters() {
        // 1. GLTFExporter من three.js
        if (typeof THREE.GLTFExporter !== 'undefined') {
            this.exporter = new THREE.GLTFExporter();
            console.log('✅ GLTFExporter (Three.js) محمل');
        } else {
            console.warn('GLTFExporter (Three.js) غير متاح');
        }
        
        // 2. المكتبة الخارجية (إذا كانت متاحة)
        if (typeof THREE !== 'undefined' && THREE.GLTFExporter) {
            try {
                this.externalGLTFExporter = THREE.GLTFExporter;
                console.log('✅ المكتبة الخارجية محملة');
            } catch (e) {
                console.warn('المكتبة الخارجية غير متاحة:', e);
            }
        }
        
        // 3. OBJExporter (سيتم إنشاؤه يدوياً)
        console.log('✅ المصدرين جاهزين للاستخدام');
    }
    
    setupLights() {
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x006400, 0.3);
        this.scene.add(hemisphereLight);
    }
    
    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8a7f70,
            roughness: 0.8,
            metalness: 0.2
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
    }
    
    createGrid() {
        const gridHelper = new THREE.GridHelper(100, 100, 0x000000, 0x000000);
        gridHelper.material.opacity = 0.2;
        gridHelper.material.transparent = true;
        this.grid = gridHelper;
        this.scene.add(this.grid);
        this.grid.visible = this.gridVisible;
    }
    
    toggleGrid() {
        this.gridVisible = !this.gridVisible;
        if (this.grid) {
            this.grid.visible = this.gridVisible;
        }
        return this.gridVisible;
    }
    
    setupEventListeners() {
        if (this.isTouchDevice) {
            this.setupTouchEvents();
        } else {
            this.setupMouseEvents();
        }
        
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
        
        this.renderer.domElement.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            return false;
        });
    }
    
    setupMouseEvents() {
        this.renderer.domElement.addEventListener('click', (event) => {
            this.handleClick(event);
        });
    }
    
    setupTouchEvents() {
        const canvas = this.renderer.domElement;
        
        canvas.addEventListener('touchmove', (e) => {
            // لمنع التمرير التلقائي أثناء التفاعل مع المشهد
            e.preventDefault();
        }, { passive: false });
        
        canvas.addEventListener('touchstart', (event) => {
            if (event.touches.length === 1) {
                const touch = event.touches[0];
                this.touchStartPos.set(touch.clientX, touch.clientY);
            }
        }, { passive: false });
        
        canvas.addEventListener('touchend', (event) => {
            if (event.changedTouches.length === 1) {
                const touch = event.changedTouches[0];
                this.touchEndPos.set(touch.clientX, touch.clientY);
                
                const deltaX = Math.abs(this.touchEndPos.x - this.touchStartPos.x);
                const deltaY = Math.abs(this.touchEndPos.y - this.touchStartPos.y);
                
                if (deltaX < this.touchMoveThreshold && deltaY < this.touchMoveThreshold) {
                    this.handleClick({
                        clientX: touch.clientX,
                        clientY: touch.clientY,
                        preventDefault: () => {}
                    });
                    
                    const currentTime = Date.now();
                    const tapLength = currentTime - this.lastTapTime;
                    
                    if (tapLength < 300 && tapLength > 0) {
                        this.handleDoubleTap(touch);
                    }
                    
                    this.lastTapTime = currentTime;
                    
                    event.preventDefault();
                }
            }
        }, { passive: false });
    }
    
    handleClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        const objectsToIntersect = [...this.objects, ...this.importedObjects];
        
        if (this.isTouchDevice) {
            this.raycaster.params.Points.threshold = 20;
            this.raycaster.params.Line.threshold = 10;
        }
        
        const intersects = this.raycaster.intersectObjects(objectsToIntersect, true);
        
        if (intersects.length > 0) {
            let object = intersects[0].object;
            
            while (object.parent && object.parent !== this.scene) {
                object = object.parent;
            }
            
            this.selectObject(object);
            
        } else {
            this.deselectObject();
        }
        
        if (this.isTouchDevice) {
            this.raycaster.params.Points.threshold = 1;
            this.raycaster.params.Line.threshold = 1;
        }
    }
    
    handleDoubleTap(touch) {
        // لا يوجد إجراء خاص للضغط المزدوج الآن
    }
    
    selectObject(object) {
        if (!object || object === this.transformControls || object === this.grid || object === this.ground) {
            this.deselectObject();
            return;
        }
        
        if (this.selectedObject === object) return;
        
        if (this.selectedObject) {
            this.deselectObject();
        }
        
        this.selectedObject = object;
        
        if (object.material) {
            if (Array.isArray(object.material)) {
                object.userData.originalEmissive = object.material.map(mat => 
                    mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000)
                );
                object.material.forEach(mat => {
                    mat.emissive = new THREE.Color(0x222222);
                });
            } else {
                object.userData.originalEmissive = object.material.emissive ? 
                    object.material.emissive.clone() : new THREE.Color(0x000000);
                object.material.emissive = new THREE.Color(0x222222);
            }
        }
        
        if (this.transformControls) {
            this.transformControls.attach(object);
            this.transformControls.visible = true;
            this.setTransformMode(this.currentTool);
            
            if (this.isTouchDevice) {
                this.transformControls.size = 1.5;
            }
        }
        
        this.updateObjectInfo();
        this.showTransformControls();
        this.showNotification(`تم تحديد ${object.name || 'كائن'}`, 'success');
    }
    
    deselectObject() {
        if (this.selectedObject) {
            if (this.selectedObject.material) {
                if (Array.isArray(this.selectedObject.material)) {
                    this.selectedObject.material.forEach((mat, index) => {
                        if (this.selectedObject.userData.originalEmissive && 
                            this.selectedObject.userData.originalEmissive[index]) {
                            mat.emissive.copy(this.selectedObject.userData.originalEmissive[index]);
                        } else {
                            mat.emissive = new THREE.Color(0x000000);
                        }
                    });
                } else {
                    if (this.selectedObject.userData.originalEmissive) {
                        this.selectedObject.material.emissive.copy(this.selectedObject.userData.originalEmissive);
                    } else {
                        this.selectedObject.material.emissive = new THREE.Color(0x000000);
                    }
                }
            }
            
            this.selectedObject = null;
        }
        
        if (this.transformControls) {
            this.transformControls.detach();
            this.transformControls.visible = false;
            
            if (this.isTouchDevice) {
                this.transformControls.size = 1;
            }
        }
        
        this.hideTransformControls();
        this.clearObjectInfo();
    }
    
    setTransformMode(mode) {
        this.currentTool = mode;
        
        if (this.transformControls && this.selectedObject) {
            switch(mode) {
                case 'translate':
                    this.transformControls.setMode('translate');
                    this.transformControls.setSpace('world');
                    break;
                case 'rotate':
                    this.transformControls.setMode('rotate');
                    this.transformControls.setSpace('world');
                    break;
                case 'scale':
                    this.transformControls.setMode('scale');
                    this.transformControls.setSpace('local');
                    break;
            }
        }
    }
    
    showTransformControls() {
        const sceneControls = document.getElementById('scene-controls');
        if (sceneControls) {
            sceneControls.classList.remove('hidden');
        }
    }
    
    hideTransformControls() {
        const sceneControls = document.getElementById('scene-controls');
        if (sceneControls) {
            sceneControls.classList.add('hidden');
        }
    }
    
    updateObjectInfo() {
        if (!this.selectedObject) return;
        
        const infoDiv = document.getElementById('object-info');
        const nameDiv = document.getElementById('selected-object-name');
        
        if (infoDiv) {
            infoDiv.classList.remove('hidden');
            
            let typeText = this.selectedObject.type;
            if (this.selectedObject.userData?.isImported) {
                typeText = 'كائن مستورد';
            } else if (this.selectedObject.userData?.isNativeObject) {
                typeText = 'كائن أصلي';
            }
            
            infoDiv.innerHTML = `
                <small>
                    <strong>${this.selectedObject.name || 'كائن'}</strong><br>
                    النوع: ${typeText}<br>
                    الموقع: ${this.selectedObject.position.x.toFixed(2)}, ${this.selectedObject.position.y.toFixed(2)}, ${this.selectedObject.position.z.toFixed(2)}
                </small>
            `;
        }
        
        if (nameDiv) {
            nameDiv.textContent = `الكائن المحدد: ${this.selectedObject.name || 'غير مسمى'}`;
        }
    }
    
    clearObjectInfo() {
        const infoDiv = document.getElementById('object-info');
        const nameDiv = document.getElementById('selected-object-name');
        
        if (infoDiv) {
            infoDiv.classList.add('hidden');
            infoDiv.innerHTML = '<small>لا يوجد كائن محدد</small>';
        }
        
        if (nameDiv) {
            nameDiv.textContent = 'لا يوجد كائن محدد';
        }
    }
    
    addObject(shapeType) {
        let geometry, material;
        
        switch(shapeType) {
            case 'cube':
                geometry = new THREE.BoxGeometry(2, 2, 2);
                material = new THREE.MeshStandardMaterial({
                    color: 0x3498db,
                    roughness: 0.5,
                    metalness: 0
                });
                break;
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(1, 1, 2, 32);
                material = new THREE.MeshStandardMaterial({
                    color: 0x2ecc71,
                    roughness: 0.5,
                    metalness: 0
                });
                break;
            case 'sphere':
                geometry = new THREE.SphereGeometry(1.5, 32, 32);
                material = new THREE.MeshStandardMaterial({
                    color: 0xe74c3c,
                    roughness: 0.5,
                    metalness: 0
                });
                break;
            case 'plane':
                geometry = new THREE.PlaneGeometry(3, 3);
                material = new THREE.MeshStandardMaterial({
                    color: 0xf39c12,
                    roughness: 0.5,
                    metalness: 0,
                    side: THREE.DoubleSide
                });
                break;
            default:
                geometry = new THREE.BoxGeometry(2, 2, 2);
                material = new THREE.MeshStandardMaterial({
                    color: 0x3498db,
                    roughness: 0.5,
                    metalness: 0
                });
        }
        
        const object = new THREE.Mesh(geometry, material);
        object.castShadow = true;
        object.receiveShadow = true;
        object.name = `${shapeType}_${Date.now()}`;
        
        object.userData.isNativeObject = true;
        
        object.position.set(
            (Math.random() - 0.5) * 20,
            1,
            (Math.random() - 0.5) * 20
        );
        
        this.scene.add(object);
        this.objects.push(object);
        this.selectObject(object);
        this.saveHistoryState();
        
        return object;
    }
    
    deleteSelectedObject() {
        if (this.selectedObject) {
            let removed = false;
            
            // البحث في الكائنات الأصلية
            const index = this.objects.indexOf(this.selectedObject);
            if (index > -1) {
                this.scene.remove(this.selectedObject);
                this.objects.splice(index, 1);
                removed = true;
            }
            
            // البحث في الكائنات المستوردة
            const importedIndex = this.importedObjects.indexOf(this.selectedObject);
            if (importedIndex > -1) {
                this.scene.remove(this.selectedObject);
                this.importedObjects.splice(importedIndex, 1);
                removed = true;
            }
            
            if (!removed) {
                this.scene.remove(this.selectedObject);
            }
            
            this.deselectObject();
            this.saveHistoryState();
            this.showNotification('تم حذف الكائن', 'success');
        }
    }
    
    duplicateSelectedObject() {
        if (this.selectedObject) {
            const clone = this.selectedObject.clone();
            clone.position.x += 2;
            clone.name = `${this.selectedObject.name}_copy_${Date.now()}`;
            
            if (Array.isArray(this.selectedObject.material)) {
                clone.material = this.selectedObject.material.map(mat => mat.clone());
            } else {
                clone.material = this.selectedObject.material.clone();
            }
            
            if (this.selectedObject.userData) {
                clone.userData = JSON.parse(JSON.stringify(this.selectedObject.userData));
            }
            
            this.scene.add(clone);
            
            if (this.selectedObject.userData?.isImported) {
                clone.userData.isImported = true;
                this.importedObjects.push(clone);
            } else {
                clone.userData.isNativeObject = true;
                this.objects.push(clone);
            }
            
            this.selectObject(clone);
            this.saveHistoryState();
            this.showNotification('تم تكرار الكائن', 'success');
        }
    }
    
    updateObjectMaterial(color, roughness, metalness, opacity) {
        if (this.selectedObject) {
            if (Array.isArray(this.selectedObject.material)) {
                this.selectedObject.material.forEach(mat => {
                    mat.color.set(color);
                    mat.roughness = roughness;
                    mat.metalness = metalness;
                    mat.opacity = opacity;
                    mat.transparent = opacity < 1;
                    mat.needsUpdate = true;
                });
            } else {
                this.selectedObject.material.color.set(color);
                this.selectedObject.material.roughness = roughness;
                this.selectedObject.material.metalness = metalness;
                this.selectedObject.material.opacity = opacity;
                this.selectedObject.material.transparent = opacity < 1;
                this.selectedObject.material.needsUpdate = true;
                
                if (this.selectedObject.userData.originalEmissive) {
                    this.selectedObject.material.emissive.copy(this.selectedObject.userData.originalEmissive);
                }
            }
        }
    }
    
    applyTextureToObject(texture, textureSize = this.textureSize, repeatU = this.textureTiling.repeatU, repeatV = this.textureTiling.repeatV) {
        if (!this.selectedObject || !texture) return;
        
        // تحسين حجم وضغط الـ Texture حسب الحجم المحدد
        this.optimizeTexture(texture, textureSize);
        
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(repeatU, repeatV);
        
        const textureId = `texture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.textures.set(textureId, texture);
        
        if (Array.isArray(this.selectedObject.material)) {
            this.selectedObject.material.forEach(mat => {
                mat.map = texture;
                mat.needsUpdate = true;
                mat.userData.textureId = textureId;
                mat.userData.textureSize = textureSize;
            });
        } else {
            this.selectedObject.material.map = texture;
            this.selectedObject.material.needsUpdate = true;
            this.selectedObject.material.userData.textureId = textureId;
            this.selectedObject.material.userData.textureSize = textureSize;
        }
        
        this.showNotification(`تم تطبيق الخامة (${textureSize}×${textureSize}) مع التكرار ${repeatU}×${repeatV}`, 'success');
    }
    
    optimizeTexture(texture, targetSize = this.textureSize) {
        // تقليل حجم الـ Texture لتحسين الأداء
        const maxSize = targetSize;
        
        if (texture.image) {
            const img = texture.image;
            
            // إذا كانت الصورة أكبر من الحد الأقصى، نقوم بتقليل حجمها
            if (img.width > maxSize || img.height > maxSize) {
                console.log(`تقليل حجم الصورة من ${img.width}x${img.height} إلى ${maxSize}x${maxSize}`);
                
                // في بيئة production، يمكن استخدام canvas لضغط الصورة
                // هنا نكتفي بتعيين حجم أصغر للذاكرة
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = false;
                
                // استخدام ضغط JPG افتراضي
                texture.format = THREE.RGBFormat;
                
                // تعيين القيم القصوى
                texture.maxWidth = maxSize;
                texture.maxHeight = maxSize;
            } else if (img.width < maxSize && img.height < maxSize) {
                // إذا كانت الصورة أصغر من الحجم المطلوب، يمكننا الاحتفاظ بحجمها
                console.log(`حجم الصورة ${img.width}x${img.height} أصغر من ${maxSize}x${maxSize} - سيتم الاحتفاظ به`);
            }
        }
        
        // إعدادات إضافية لتحسين الأداء
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
        if (texture.anisotropy > 4) {
            texture.anisotropy = 4; // الحد من anisotropy لتوفير الذاكرة
        }
        
        // تحسين إعدادات الميب ماب بناءً على الحجم
        if (maxSize >= 512) {
            texture.minFilter = THREE.LinearMipMapLinearFilter;
            texture.generateMipmaps = true;
        } else if (maxSize >= 256) {
            texture.minFilter = THREE.LinearMipMapNearestFilter;
            texture.generateMipmaps = true;
        } else {
            texture.minFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
        }
    }
    
    updateTextureTiling(repeatU, repeatV) {
        this.textureTiling.repeatU = repeatU;
        this.textureTiling.repeatV = repeatV;
        
        if (this.selectedObject && this.selectedObject.material) {
            if (Array.isArray(this.selectedObject.material)) {
                this.selectedObject.material.forEach(mat => {
                    if (mat.map) {
                        mat.map.repeat.set(repeatU, repeatV);
                        mat.map.needsUpdate = true;
                        mat.needsUpdate = true;
                    }
                });
            } else if (this.selectedObject.material.map) {
                this.selectedObject.material.map.repeat.set(repeatU, repeatV);
                this.selectedObject.material.map.needsUpdate = true;
                this.selectedObject.material.needsUpdate = true;
            }
        }
    }
    
    // =============================================
    // دالات التصدير المحسنة مع مكتبات خارجية
    // =============================================
    
    exportScene(format) {
        if (!this.exporter && format !== 'obj') {
            this.showNotification('مكتبة التصدير غير متاحة', 'error');
            return;
        }
        
        // التحقق من وجود كائنات للتصدير
        const totalObjects = this.objects.length + this.importedObjects.length;
        if (totalObjects === 0) {
            this.showNotification('لا توجد كائنات للتصدير', 'warning');
            return;
        }
        
        switch(format) {
            case 'glb':
                this.exportToGLB();
                break;
            case 'gltf':
                this.exportToGLTF();
                break;
            case 'obj':
                this.exportToOBJ();
                break;
            default:
                this.showNotification('تنسيق غير مدعوم', 'error');
        }
    }
    
    exportToGLB() {
        this.showLoading('جاري تصدير مشهد كـ GLB...');
        
        try {
            // إنشاء مجموعة للتصدير
            const exportGroup = this.createExportGroup();
            
            if (exportGroup.children.length === 0) {
                this.hideLoading();
                this.showNotification('لا توجد كائنات مرئية للتصدير', 'warning');
                return;
            }
            
            console.log('تصدير GLB:', exportGroup.children.length, 'كائن');
            
            // استخدام GLTFExporter من three.js مع إعدادات محسنة
            const options = {
                binary: true,
                trs: false,
                onlyVisible: true,
                truncateDrawRange: true,
                embedImages: false, // إيقاف تضمين الصور لتجنب المشاكل
                animations: []
            };
            
            this.exporter.parse(
                exportGroup,
                (result) => {
                    try {
                        console.log('ناتج GLTFExporter:', result);
                        
                        let glbArrayBuffer;
                        
                        // طريقة آمنة للحصول على ArrayBuffer
                        if (result instanceof ArrayBuffer) {
                            glbArrayBuffer = result;
                        } else if (result.buffers && result.buffers[0] instanceof ArrayBuffer) {
                            glbArrayBuffer = result.buffers[0];
                        } else if (result instanceof Uint8Array) {
                            glbArrayBuffer = result.buffer;
                        } else {
                            // محاولة بديلة: استخدام JSON.stringify ثم تحويل
                            console.warn('المحاولة البديلة لإنشاء GLB');
                            const gltfJson = JSON.stringify(result);
                            glbArrayBuffer = new TextEncoder().encode(gltfJson).buffer;
                        }
                        
                        // إنشاء ملف باستخدام FileSaver.js إذا كان متاحاً
                        if (typeof saveAs !== 'undefined') {
                            const blob = new Blob([glbArrayBuffer], { 
                                type: 'model/gltf-binary' 
                            });
                            saveAs(blob, `scene_${Date.now()}.glb`);
                            this.hideLoading();
                            this.showNotification('تم تصدير GLB بنجاح', 'success');
                        } else {
                            // طريقة بديلة
                            this.downloadFile(glbArrayBuffer, `scene_${Date.now()}.glb`, 'model/gltf-binary');
                        }
                        
                    } catch (error) {
                        console.error('خطأ في معالجة GLB:', error);
                        this.hideLoading();
                        this.showNotification('خطأ في إنشاء ملف GLB', 'error');
                        
                        // محاولة بديلة: تصدير كـ OBJ
                        setTimeout(() => {
                            if (confirm('فشل تصدير GLB. هل تريد تصدير كـ OBJ بدلاً من ذلك؟')) {
                                this.exportToOBJ();
                            }
                        }, 500);
                    }
                },
                (error) => {
                    console.error('خطأ في تصدير GLB:', error);
                    this.hideLoading();
                    this.showNotification('فشل تصدير GLB: ' + (error.message || 'خطأ غير معروف'), 'error');
                },
                options
            );
            
        } catch (error) {
            console.error('خطأ عام في تصدير GLB:', error);
            this.hideLoading();
            this.showNotification('خطأ في تصدير GLB', 'error');
        }
    }
    
    exportToGLTF() {
        this.showLoading('جاري تصدير مشهد كـ GLTF...');
        
        try {
            const exportGroup = this.createExportGroup();
            
            if (exportGroup.children.length === 0) {
                this.hideLoading();
                this.showNotification('لا توجد كائنات مرئية للتصدير', 'warning');
                return;
            }
            
            // تصدير كـ GLTF (JSON)
            const options = {
                binary: false, // JSON وليس binary
                trs: false,
                onlyVisible: true,
                embedImages: false
            };
            
            this.exporter.parse(
                exportGroup,
                (result) => {
                    try {
                        const gltfJson = JSON.stringify(result, null, 2);
                        const blob = new Blob([gltfJson], { type: 'model/gltf+json' });
                        
                        if (typeof saveAs !== 'undefined') {
                            saveAs(blob, `scene_${Date.now()}.gltf`);
                        } else {
                            this.downloadFile(new TextEncoder().encode(gltfJson).buffer, `scene_${Date.now()}.gltf`, 'model/gltf+json');
                        }
                        
                        this.hideLoading();
                        this.showNotification('تم تصدير GLTF بنجاح', 'success');
                        
                    } catch (error) {
                        console.error('خطأ في معالجة GLTF:', error);
                        this.hideLoading();
                        this.showNotification('خطأ في إنشاء ملف GLTF', 'error');
                    }
                },
                (error) => {
                    console.error('خطأ في تصدير GLTF:', error);
                    this.hideLoading();
                    this.showNotification('فشل تصدير GLTF', 'error');
                },
                options
            );
            
        } catch (error) {
            console.error('خطأ عام في تصدير GLTF:', error);
            this.hideLoading();
            this.showNotification('خطأ في تصدير GLTF', 'error');
        }
    }
    
    exportToOBJ() {
        this.showLoading('جاري تصدير مشهد كـ OBJ...');
        
        try {
            // إنشاء محتوى OBJ يدوياً
            let objContent = "# Exported from 3D Editor\n";
            let mtlContent = "# Material definitions\n";
            let vertexIndex = 1;
            let materialIndex = 0;
            const materialsMap = new Map();
            
            // دالة لإنشاء مادة OBJ
            const createMaterial = (material, name) => {
                if (materialsMap.has(material.uuid)) {
                    return materialsMap.get(material.uuid);
                }
                
                const mtlName = `material_${materialIndex++}`;
                materialsMap.set(material.uuid, mtlName);
                
                mtlContent += `\nnewmtl ${mtlName}\n`;
                mtlContent += `Ka ${material.color.r} ${material.color.g} ${material.color.b}\n`;
                mtlContent += `Kd ${material.color.r} ${material.color.g} ${material.color.b}\n`;
                mtlContent += `Ks 0.5 0.5 0.5\n`;
                mtlContent += `Ns 32\n`;
                mtlContent += `d ${material.opacity}\n`;
                mtlContent += `illum 2\n`;
                
                return mtlName;
            };
            
            // جمع جميع الكائنات
            const allObjects = [...this.objects, ...this.importedObjects];
            
            for (const obj of allObjects) {
                if (!obj.visible) continue;
                
                obj.traverse((child) => {
                    if (child.isMesh && child.geometry) {
                        const geometry = child.geometry;
                        
                        // اسم الكائن
                        objContent += `\no ${child.name || 'object'}\n`;
                        
                        // المواد
                        let materialName = 'default';
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                materialName = createMaterial(child.material[0], 'material');
                            } else {
                                materialName = createMaterial(child.material, 'material');
                            }
                            objContent += `usemtl ${materialName}\n`;
                        }
                        
                        // تحويل المواقع إلى إحداثيات عالمية
                        const matrix = child.matrixWorld;
                        const positions = geometry.attributes.position;
                        
                        // إضافة القمم (vertices)
                        for (let i = 0; i < positions.count; i++) {
                            const vertex = new THREE.Vector3();
                            vertex.fromBufferAttribute(positions, i);
                            vertex.applyMatrix4(matrix);
                            objContent += `v ${vertex.x.toFixed(6)} ${vertex.y.toFixed(6)} ${vertex.z.toFixed(6)}\n`;
                        }
                        
                        // إضافة الوجوه (faces)
                        if (geometry.index) {
                            const indices = geometry.index.array;
                            for (let i = 0; i < indices.length; i += 3) {
                                const v1 = vertexIndex + indices[i];
                                const v2 = vertexIndex + indices[i + 1];
                                const v3 = vertexIndex + indices[i + 2];
                                objContent += `f ${v1} ${v2} ${v3}\n`;
                            }
                        } else {
                            for (let i = 0; i < positions.count; i += 3) {
                                const v1 = vertexIndex + i;
                                const v2 = vertexIndex + i + 1;
                                const v3 = vertexIndex + i + 2;
                                objContent += `f ${v1} ${v2} ${v3}\n`;
                            }
                        }
                        
                        vertexIndex += positions.count;
                    }
                });
            }
            
            // إنشاء ملفات OBJ و MTL
            const timestamp = Date.now();
            
            // ملف OBJ
            const objBlob = new Blob([objContent], { type: 'text/plain' });
            saveAs(objBlob, `scene_${timestamp}.obj`);
            
            // ملف MTL (إذا كانت هناك مواد)
            if (mtlContent.length > 30) { // أكثر من مجرد التعليق
                const mtlBlob = new Blob([mtlContent], { type: 'text/plain' });
                saveAs(mtlBlob, `scene_${timestamp}.mtl`);
            }
            
            this.hideLoading();
            this.showNotification('تم تصدير OBJ بنجاح', 'success');
            
        } catch (error) {
            console.error('خطأ في تصدير OBJ:', error);
            this.hideLoading();
            this.showNotification('خطأ في تصدير OBJ: ' + error.message, 'error');
        }
    }
    
    createExportGroup() {
        const exportGroup = new THREE.Group();
        exportGroup.name = 'ExportedScene';
        
        // جمع الكائنات الأصلية
        this.objects.forEach(obj => {
            if (obj.visible && obj.userData?.isNativeObject) {
                try {
                    const clonedObj = this.cloneForExport(obj);
                    if (clonedObj) exportGroup.add(clonedObj);
                } catch (e) {
                    console.warn('خطأ في نسخ الكائن:', e);
                }
            }
        });
        
        // جمع الكائنات المستوردة
        this.importedObjects.forEach(obj => {
            if (obj.visible) {
                try {
                    const clonedObj = this.cloneForExport(obj);
                    if (clonedObj) exportGroup.add(clonedObj);
                } catch (e) {
                    console.warn('خطأ في نسخ الكائن المستورد:', e);
                }
            }
        });
        
        return exportGroup;
    }
    
    cloneForExport(object) {
        try {
            const clone = object.clone();
            
            // نسخ المواد
            if (object.material) {
                if (Array.isArray(object.material)) {
                    clone.material = object.material.map(mat => {
                        const clonedMat = mat.clone();
                        clonedMat.needsUpdate = true;
                        return clonedMat;
                    });
                } else {
                    clone.material = object.material.clone();
                    clone.material.needsUpdate = true;
                }
            }
            
            // إعدادات أساسية
            clone.name = object.name || `object_${Date.now()}`;
            clone.castShadow = false; // إيقاف الظلال للتصدير
            clone.receiveShadow = false;
            clone.visible = true;
            
            return clone;
        } catch (error) {
            console.warn('خطأ في النسخ:', error);
            return null;
        }
    }
    
    downloadFile(arrayBuffer, filename, mimeType) {
        try {
            const blob = new Blob([arrayBuffer], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }, 100);
            
        } catch (error) {
            console.error('خطأ في تحميل الملف:', error);
            throw error;
        }
    }
    
    importFromGLTF(file) {
        if (file.size > 100 * 1024 * 1024) {
            this.showNotification('حجم الملف كبير جداً (الحد الأقصى 100MB)', 'error');
            return;
        }
        
        this.showLoading('جاري استيراد ملف...');
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const arrayBuffer = event.target.result;
                
                this.gltfLoader.parse(arrayBuffer, '', (gltf) => {
                    const importedScene = gltf.scene;
                    
                    importedScene.scale.set(1, 1, 1);
                    importedScene.position.set(0, 0, 0);
                    
                    importedScene.userData = {
                        isImported: true,
                        importTime: Date.now(),
                        fileName: file.name
                    };
                    
                    importedScene.name = `imported_${Date.now()}`;
                    
                    importedScene.traverse((child) => {
                        if (child.isMesh || child.isLine) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                            
                            if (!child.name || child.name === '') {
                                child.name = `imported_mesh_${Date.now()}`;
                            }
                            
                            if (child.material) {
                                child.material.needsUpdate = true;
                            }
                        }
                    });
                    
                    const box = new THREE.Box3().setFromObject(importedScene);
                    importedScene.position.y -= box.min.y;
                    
                    this.scene.add(importedScene);
                    this.importedObjects.push(importedScene);
                    
                    this.hideLoading();
                    this.saveHistoryState();
                    this.showNotification('تم استيراد الملف بنجاح', 'success');
                    
                    setTimeout(() => {
                        this.selectObject(importedScene);
                    }, 100);
                    
                }, (error) => {
                    this.hideLoading();
                    this.showNotification('خطأ في استيراد الملف: ' + error.message, 'error');
                });
                
            } catch (error) {
                this.hideLoading();
                this.showNotification('خطأ في معالجة الملف: ' + error.message, 'error');
            }
        };
        
        reader.onerror = () => {
            this.hideLoading();
            this.showNotification('خطأ في قراءة الملف', 'error');
        };
        
        reader.readAsArrayBuffer(file);
    }
    
    importFromOBJ(file) {
        this.showLoading('جاري استيراد ملف OBJ...');
        
        // في حال لم تكن مكتبة OBJLoader محملة
        if (!this.objLoader) {
            try {
                // محاولة تحميل OBJLoader ديناميكياً
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/OBJLoader.min.js';
                script.onload = () => {
                    if (typeof THREE.OBJLoader !== 'undefined') {
                        this.objLoader = new THREE.OBJLoader();
                        this.finishOBJImport(file);
                    } else {
                        this.hideLoading();
                        this.showNotification('تعذر تحميل مكتبة OBJLoader', 'error');
                    }
                };
                script.onerror = () => {
                    this.hideLoading();
                    this.showNotification('تعذر تحميل مكتبة OBJLoader', 'error');
                };
                document.head.appendChild(script);
            } catch (error) {
                this.hideLoading();
                this.showNotification('خطأ في تحميل مكتبة OBJ: ' + error.message, 'error');
            }
        } else {
            this.finishOBJImport(file);
        }
    }
    
    finishOBJImport(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const objContent = event.target.result;
                const importedScene = this.objLoader.parse(objContent);
                
                importedScene.scale.set(1, 1, 1);
                importedScene.position.set(0, 0, 0);
                
                importedScene.userData = {
                    isImported: true,
                    importTime: Date.now(),
                    fileName: file.name,
                    fileType: 'obj'
                };
                
                importedScene.name = `imported_obj_${Date.now()}`;
                
                importedScene.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        if (!child.name || child.name === '') {
                            child.name = `imported_obj_mesh_${Date.now()}`;
                        }
                        
                        if (!child.material) {
                            child.material = new THREE.MeshStandardMaterial({
                                color: 0x888888,
                                roughness: 0.5,
                                metalness: 0
                            });
                        }
                        child.material.needsUpdate = true;
                    }
                });
                
                const box = new THREE.Box3().setFromObject(importedScene);
                importedScene.position.y -= box.min.y;
                
                this.scene.add(importedScene);
                this.importedObjects.push(importedScene);
                
                this.hideLoading();
                this.saveHistoryState();
                this.showNotification('تم استيراد ملف OBJ بنجاح', 'success');
                
                setTimeout(() => {
                    this.selectObject(importedScene);
                }, 100);
                
            } catch (error) {
                this.hideLoading();
                this.showNotification('خطأ في معالجة ملف OBJ: ' + error.message, 'error');
            }
        };
        
        reader.onerror = () => {
            this.hideLoading();
            this.showNotification('خطأ في قراءة ملف OBJ', 'error');
        };
        
        reader.readAsText(file);
    }
    
    saveHistoryState() {
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }
        
        const state = {
            objects: this.objects.filter(obj => obj.userData?.isNativeObject).map(obj => this.serializeObject(obj)),
            importedObjects: this.importedObjects.map(obj => this.serializeImportedObject(obj)),
            timestamp: Date.now()
        };
        
        this.history.push(state);
        this.historyIndex++;
        
        if (this.history.length > this.maxHistory) {
            this.history.shift();
            this.historyIndex--;
        }
        
        this.updateUndoRedoButtons();
    }
    
    serializeObject(obj) {
        return {
            uuid: obj.uuid,
            type: obj.type,
            name: obj.name,
            geometry: obj.geometry.type,
            position: obj.position.toArray(),
            rotation: obj.rotation.toArray(),
            scale: obj.scale.toArray(),
            material: obj.material ? {
                color: obj.material.color ? obj.material.color.getHex() : 0x3498db,
                roughness: obj.material.roughness,
                metalness: obj.material.metalness,
                opacity: obj.material.opacity
            } : null,
            castShadow: obj.castShadow,
            receiveShadow: obj.receiveShadow,
            userData: {
                isNativeObject: true
            }
        };
    }
    
    serializeImportedObject(obj) {
        return {
            type: obj.type,
            name: obj.name,
            position: obj.position.toArray(),
            rotation: obj.rotation.toArray(),
            scale: obj.scale.toArray(),
            userData: {
                isImported: true,
                fileName: obj.userData?.fileName || 'unknown',
                fileType: obj.userData?.fileType || 'glb'
            }
        };
    }
    
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreHistoryState(this.historyIndex);
            this.showNotification('تم التراجع', 'info');
        }
    }
    
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreHistoryState(this.historyIndex);
            this.showNotification('تم الإعادة', 'info');
        }
    }
    
    restoreHistoryState(index) {
        const state = this.history[index];
        
        this.objects.forEach(obj => this.scene.remove(obj));
        this.objects = [];
        
        this.importedObjects.forEach(obj => this.scene.remove(obj));
        this.importedObjects = [];
        
        if (state.objects) {
            state.objects.forEach(objData => {
                try {
                    const object = this.deserializeObject(objData);
                    if (object) {
                        this.scene.add(object);
                        this.objects.push(object);
                    }
                } catch (error) {
                    console.warn('خطأ في استعادة الكائن:', error);
                }
            });
        }
        
        if (state.importedObjects) {
            if (state.importedObjects.length > 0) {
                this.showNotification('لا يمكن استعادة الكائنات المستوردة من الملفات. يرجى إعادة استيرادها يدوياً.', 'warning');
            }
        }
        
        this.updateUndoRedoButtons();
        this.deselectObject();
    }
    
    deserializeObject(objData) {
        let geometry;
        
        switch(objData.geometry) {
            case 'BoxGeometry':
                geometry = new THREE.BoxGeometry(2, 2, 2);
                break;
            case 'SphereGeometry':
                geometry = new THREE.SphereGeometry(1.5, 32, 32);
                break;
            case 'CylinderGeometry':
                geometry = new THREE.CylinderGeometry(1, 1, 2, 32);
                break;
            case 'PlaneGeometry':
                geometry = new THREE.PlaneGeometry(3, 3);
                break;
            default:
                geometry = new THREE.BoxGeometry(2, 2, 2);
        }
        
        const material = new THREE.MeshStandardMaterial({
            color: objData.material?.color || 0x3498db,
            roughness: objData.material?.roughness || 0.5,
            metalness: objData.material?.metalness || 0,
            opacity: objData.material?.opacity || 1,
            transparent: (objData.material?.opacity || 1) < 1
        });
        
        const object = new THREE.Mesh(geometry, material);
        object.name = objData.name || `restored_${Date.now()}`;
        
        if (objData.position) {
            object.position.fromArray(objData.position);
        }
        
        if (objData.rotation) {
            object.rotation.fromArray(objData.rotation);
        }
        
        if (objData.scale) {
            object.scale.fromArray(objData.scale);
        }
        
        object.castShadow = objData.castShadow !== undefined ? objData.castShadow : true;
        object.receiveShadow = objData.receiveShadow !== undefined ? objData.receiveShadow : true;
        
        if (objData.userData) {
            object.userData = objData.userData;
        }
        
        return object;
    }
    
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undo-btn-hud');
        const redoBtn = document.getElementById('redo-btn-hud');
        
        if (undoBtn) {
            undoBtn.disabled = this.historyIndex <= 0;
        }
        
        if (redoBtn) {
            redoBtn.disabled = this.historyIndex >= this.history.length - 1;
        }
    }
    
    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
    
    handleKeyDown(event) {
        if (event.ctrlKey && event.key === 'z') {
            event.preventDefault();
            this.undo();
        }
        
        if (event.ctrlKey && event.key === 'y') {
            event.preventDefault();
            this.redo();
        }
        
        if (event.key === 'Delete' && this.selectedObject) {
            this.deleteSelectedObject();
        }
        
        if (event.key === 'Escape') {
            this.deselectObject();
        }
        
        if (event.key === 'w' || event.key === 'W') {
            this.setTransformMode('translate');
            this.updateUIForTool('translate');
        }
        if (event.key === 'e' || event.key === 'E') {
            this.setTransformMode('rotate');
            this.updateUIForTool('rotate');
        }
        if (event.key === 'r' || event.key === 'R') {
            this.setTransformMode('scale');
            this.updateUIForTool('scale');
        }
    }
    
    updateUIForTool(tool) {
        const buttons = ['translate-btn', 'rotate-btn', 'scale-btn'];
        buttons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) {
                btn.classList.remove('active');
            }
        });
        
        const activeBtn = document.getElementById(`${tool}-btn`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
    
    clearScene() {
        if (!confirm('هل أنت متأكد من مسح المشهد بالكامل؟')) {
            return;
        }
        
        this.clearSceneSilently();
        this.saveHistoryState();
        this.showNotification('تم مسح المشهد', 'success');
    }
    
    clearSceneSilently() {
        this.objects.forEach(obj => {
            this.scene.remove(obj);
        });
        this.objects = [];
        
        this.importedObjects.forEach(obj => {
            this.scene.remove(obj);
        });
        this.importedObjects = [];
        
        this.deselectObject();
    }
    
    resetView() {
        this.camera.position.set(20, 15, 20);
        this.camera.lookAt(0, 0, 0);
        this.controls.reset();
        this.showNotification('تم إعادة ضبط العرض', 'info');
    }
    
    showNotification(message, type = 'info') {
        const notifications = document.getElementById('notifications');
        if (!notifications) return;
        
        if (notifications.classList.contains('hidden')) {
            return;
        }
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        notifications.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode === notifications) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                
                setTimeout(() => {
                    if (notification.parentNode === notifications) {
                        notifications.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    }
    
    showLoading(text) {
        const loading = document.getElementById('loading');
        const loadingText = document.getElementById('loading-text');
        
        if (loading && loadingText) {
            loadingText.textContent = text;
            loading.classList.remove('hidden');
        }
    }
    
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('hidden');
        }
    }
    
    updateProgress(percent) {
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            progressFill.style.width = `${percent}%`;
        }
    }
    
    startMemoryMonitoring() {
        setInterval(() => {
            this.updateMemoryUsage();
        }, 30000);
    }
    
    updateMemoryUsage() {
        if (window.performance && window.performance.memory) {
            const usedMB = Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024);
            const memoryElement = document.getElementById('memory-usage');
            
            if (memoryElement) {
                memoryElement.textContent = usedMB;
            }
        }
    }
    
    cleanMemory() {
        try {
            // تنظيف Textures غير المستخدمة
            this.textures.forEach((texture, key) => {
                if (!this.isTextureInUse(key)) {
                    texture.dispose();
                    this.textures.delete(key);
                }
            });
            
            // إجبار جمع القمامة في المتصفحات التي تدعمه
            if (window.gc) {
                window.gc();
            }
            
            this.showNotification('تم تنظيف الذاكرة', 'info');
        } catch (error) {
            console.warn('خطأ في تنظيف الذاكرة:', error);
        }
    }
    
    isTextureInUse(textureId) {
        // التحقق مما إذا كانت الـ Texture مستخدمة في أي كائن
        const allObjects = [...this.objects, ...this.importedObjects];
        
        for (const obj of allObjects) {
            if (obj.material) {
                if (Array.isArray(obj.material)) {
                    for (const mat of obj.material) {
                        if (mat.userData?.textureId === textureId) {
                            return true;
                        }
                    }
                } else if (obj.material.userData?.textureId === textureId) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    setTheme(isDark) {
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            this.scene.background = new THREE.Color(0x1a1a1a);
        } else {
            document.documentElement.removeAttribute('data-theme');
            this.scene.background = new THREE.Color(0xf0f0f0);
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.controls) {
            this.controls.update();
        }
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
}

window.sceneManager = null;