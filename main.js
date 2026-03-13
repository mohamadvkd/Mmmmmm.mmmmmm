// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    // تهيئة مدير المشهد
    try {
        window.sceneManager = new SceneManager('scene-container');
        
        // تهيئة جميع معالجات الأحداث
        initEventHandlers();
        
        // ضبط الوضع الافتراضي
        applyDefaultSettings();
        
        // إظهار إشعار الترحيب
        setTimeout(() => {
            if (sceneManager) {
                sceneManager.showNotification('مرحباً في محرر الأشكال ثلاثي الأبعاد', 'info');
            }
        }, 1000);
        
        console.log('✅ التطبيق تم تحميله بنجاح');
        
    } catch (error) {
        console.error('❌ خطأ في تهيئة التطبيق:', error);
        showErrorPage(error);
    }
});

// معالجات الأحداث الرئيسية
function initEventHandlers() {
    try {
        // زر القائمة الرئيسي
        const menuToggle = document.getElementById('menu-toggle');
        const closeMenu = document.getElementById('close-menu');
        
        if (menuToggle) menuToggle.addEventListener('click', toggleSideMenu);
        if (closeMenu) closeMenu.addEventListener('click', toggleSideMenu);
        
        // زر إضافة كائن
        const addObjectBtn = document.getElementById('add-object');
        if (addObjectBtn) {
            addObjectBtn.addEventListener('click', () => {
                const firstShape = document.querySelector('[data-shape="cube"]');
                if (firstShape) {
                    firstShape.click();
                }
            });
        }
        
        // زر إظهار/إخفاء الشبكة
        const toggleGridBtn = document.getElementById('toggle-grid');
        if (toggleGridBtn) {
            toggleGridBtn.addEventListener('click', toggleGrid);
        }
        
        // زر إخفاء/إظهار الإشعارات
        const toggleNotificationsBtn = document.getElementById('toggle-notifications');
        if (toggleNotificationsBtn) {
            toggleNotificationsBtn.addEventListener('click', toggleNotifications);
        }
        
        // أزرار التراجع والإعادة في HUD
        const undoBtnHud = document.getElementById('undo-btn-hud');
        if (undoBtnHud) {
            undoBtnHud.addEventListener('click', () => {
                if (sceneManager) {
                    sceneManager.undo();
                }
            });
        }
        
        const redoBtnHud = document.getElementById('redo-btn-hud');
        if (redoBtnHud) {
            redoBtnHud.addEventListener('click', () => {
                if (sceneManager) {
                    sceneManager.redo();
                }
            });
        }
        
        // أزرار الأشكال
        document.querySelectorAll('[data-shape]').forEach(button => {
            button.addEventListener('click', (e) => {
                const shapeType = e.target.dataset.shape;
                if (sceneManager) {
                    const object = sceneManager.addObject(shapeType);
                    if (object) {
                        sceneManager.showNotification(`تم إضافة ${getShapeName(shapeType)}`, 'success');
                    }
                }
            });
        });
        
        // التحكم في الكائن
        const deleteObjectBtn = document.getElementById('delete-object');
        if (deleteObjectBtn) {
            deleteObjectBtn.addEventListener('click', () => {
                if (sceneManager) {
                    sceneManager.deleteSelectedObject();
                }
            });
        }
        
        const duplicateObjectBtn = document.getElementById('duplicate-object');
        if (duplicateObjectBtn) {
            duplicateObjectBtn.addEventListener('click', () => {
                if (sceneManager) {
                    sceneManager.duplicateSelectedObject();
                }
            });
        }
        
        // خصائص المادة
        const objectColor = document.getElementById('object-color');
        if (objectColor) {
            objectColor.addEventListener('input', updateObjectMaterial);
        }
        
        setupSliderControl('roughness', 'roughness-value', updateObjectMaterial);
        setupSliderControl('metalness', 'metalness-value', updateObjectMaterial);
        setupSliderControl('opacity', 'opacity-value', updateObjectMaterial);
        
        // تكرار الخامة
        setupSliderControl('texture-repeat-u', 'texture-repeat-u-value', (value) => {
            if (sceneManager) {
                sceneManager.textureTiling.repeatU = parseInt(value);
                if (sceneManager.selectedObject && sceneManager.selectedObject.material) {
                    sceneManager.updateTextureTiling(
                        sceneManager.textureTiling.repeatU,
                        sceneManager.textureTiling.repeatV
                    );
                }
            }
        });
        
        setupSliderControl('texture-repeat-v', 'texture-repeat-v-value', (value) => {
            if (sceneManager) {
                sceneManager.textureTiling.repeatV = parseInt(value);
                if (sceneManager.selectedObject && sceneManager.selectedObject.material) {
                    sceneManager.updateTextureTiling(
                        sceneManager.textureTiling.repeatU,
                        sceneManager.textureTiling.repeatV
                    );
                }
            }
        });
        
        const applyTextureTilingBtn = document.getElementById('apply-texture-tiling');
        if (applyTextureTilingBtn) {
            applyTextureTilingBtn.addEventListener('click', () => {
                if (sceneManager) {
                    const repeatU = parseInt(document.getElementById('texture-repeat-u').value);
                    const repeatV = parseInt(document.getElementById('texture-repeat-v').value);
                    
                    sceneManager.updateTextureTiling(repeatU, repeatV);
                    sceneManager.showNotification(
                        `تم تطبيق تكرار الخامة ${repeatU}×${repeatV}`,
                        'success'
                    );
                }
            });
        }
        
        // خيارات حجم الخامة
        setupTextureSizeOptions();
        
        const snapMode = document.getElementById('snap-mode');
        if (snapMode) {
            snapMode.addEventListener('change', (e) => {
                if (sceneManager) {
                    sceneManager.snapEnabled = e.target.checked;
                    sceneManager.showNotification(
                        e.target.checked ? 'تم تفعيل نظام Snap' : 'تم إيقاف نظام Snap',
                        'info'
                    );
                }
            });
        }
        
        // الخامات المخصصة (JPG/PNG)
        const loadTextureBtn = document.getElementById('load-texture');
        if (loadTextureBtn) {
            loadTextureBtn.addEventListener('click', () => {
                document.getElementById('texture-file').click();
            });
        }
        
        const textureFile = document.getElementById('texture-file');
        if (textureFile) {
            textureFile.addEventListener('change', handleTextureUpload);
        }
        
        const applyTextureBtn = document.getElementById('apply-texture');
        if (applyTextureBtn) {
            applyTextureBtn.addEventListener('click', applyTextureToObject);
        }
        
        // التحكم في المشهد
        const translateBtn = document.getElementById('translate-btn');
        const rotateBtn = document.getElementById('rotate-btn');
        const scaleBtn = document.getElementById('scale-btn');
        
        if (translateBtn) translateBtn.addEventListener('click', () => setActiveControl('translate'));
        if (rotateBtn) rotateBtn.addEventListener('click', () => setActiveControl('rotate'));
        if (scaleBtn) scaleBtn.addEventListener('click', () => setActiveControl('scale'));
        
        // الملفات - التصدير المتعدد
        const exportGLBBtn = document.getElementById('export-glb');
        if (exportGLBBtn) {
            exportGLBBtn.addEventListener('click', () => {
                if (sceneManager) {
                    sceneManager.exportScene('glb');
                }
            });
        }
        
        const exportGLTFBtn = document.getElementById('export-gltf');
        if (exportGLTFBtn) {
            exportGLTFBtn.addEventListener('click', () => {
                if (sceneManager) {
                    sceneManager.exportScene('gltf');
                }
            });
        }
        
        const exportOBJBtn = document.getElementById('export-obj');
        if (exportOBJBtn) {
            exportOBJBtn.addEventListener('click', () => {
                if (sceneManager) {
                    sceneManager.exportScene('obj');
                }
            });
        }
        
        // الاستيراد
        const importGLTFBtn = document.getElementById('import-glb-btn');
        if (importGLTFBtn) {
            importGLTFBtn.addEventListener('click', () => {
                document.getElementById('import-gltf').click();
            });
        }
        
        const importGLTF = document.getElementById('import-gltf');
        if (importGLTF) {
            importGLTF.addEventListener('change', (e) => {
                if (e.target.files[0]) {
                    handleFileImport(e.target.files[0]);
                    e.target.value = '';
                }
            });
        }
        
        // تنظيف الذاكرة
        const cleanMemoryBtn = document.getElementById('clean-memory');
        if (cleanMemoryBtn) {
            cleanMemoryBtn.addEventListener('click', () => {
                if (sceneManager) {
                    sceneManager.cleanMemory();
                }
            });
        }
        
        // الإعدادات
        const clearSceneBtn = document.getElementById('clear-scene');
        if (clearSceneBtn) {
            clearSceneBtn.addEventListener('click', () => {
                if (sceneManager) {
                    sceneManager.clearScene();
                }
            });
        }
        
        const gridVisible = document.getElementById('grid-visible');
        if (gridVisible) {
            gridVisible.addEventListener('change', (e) => {
                if (sceneManager) {
                    sceneManager.gridVisible = e.target.checked;
                    if (sceneManager.grid) {
                        sceneManager.grid.visible = e.target.checked;
                    }
                    localStorage.setItem('gridVisible', e.target.checked);
                }
            });
        }
        
        const darkMode = document.getElementById('dark-mode');
        if (darkMode) {
            darkMode.addEventListener('change', (e) => {
                if (sceneManager) {
                    sceneManager.setTheme(e.target.checked);
                    localStorage.setItem('darkMode', e.target.checked);
                }
            });
        }
        
        const resetViewBtn = document.getElementById('reset-view');
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', () => {
                if (sceneManager) {
                    sceneManager.resetView();
                }
            });
        }
        
        // إلغاء التحميل
        const cancelLoadingBtn = document.getElementById('cancel-loading');
        if (cancelLoadingBtn) {
            cancelLoadingBtn.addEventListener('click', () => {
                if (sceneManager) {
                    sceneManager.hideLoading();
                }
            });
        }
        
        // تحديث واجهة المستخدم بانتظام
        setupUIUpdates();
        
        console.log('✅ معالجات الأحداث تم تهيئتها بنجاح');
        
    } catch (error) {
        console.error('❌ خطأ في تهيئة معالجات الأحداث:', error);
    }
}

// إعداد خيارات حجم الخامة
function setupTextureSizeOptions() {
    // العناصر
    const textureSizeOptions = document.querySelectorAll('.texture-size-option input[type="radio"]');
    const textureSizeOptionLabels = document.querySelectorAll('.texture-size-option');
    
    // الحدث عند تغيير حجم الخامة
    textureSizeOptions.forEach((radio, index) => {
        radio.addEventListener('change', (e) => {
            if (e.target.checked) {
                const selectedSize = parseInt(e.target.value);
                
                // تحديث النشاط البصري
                textureSizeOptionLabels.forEach(label => {
                    label.classList.remove('active');
                });
                textureSizeOptionLabels[index].classList.add('active');
                
                // حفظ الإعداد في localStorage
                localStorage.setItem('textureSize', selectedSize);
                
                // تحديث حجم الخامة النشطة إذا كانت موجودة
                if (sceneManager && sceneManager.activeTexture) {
                    sceneManager.textureSize = selectedSize;
                    sceneManager.showNotification(`تم تعيين حجم الخامة إلى ${selectedSize}×${selectedSize} بكسل`, 'info');
                }
            }
        });
    });
    
    // استعادة الإعداد المحفوظ
    const savedSize = localStorage.getItem('textureSize');
    if (savedSize) {
        const radioToSelect = document.querySelector(`.texture-size-option input[value="${savedSize}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
            radioToSelect.dispatchEvent(new Event('change'));
        }
    } else {
        // الحجم الافتراضي: 256
        const defaultRadio = document.querySelector('.texture-size-option input[value="256"]');
        if (defaultRadio) {
            defaultRadio.checked = true;
            const defaultIndex = Array.from(textureSizeOptions).indexOf(defaultRadio);
            textureSizeOptionLabels[defaultIndex].classList.add('active');
            localStorage.setItem('textureSize', '256');
        }
    }
}

// الحصول على حجم الخامة المحدد
function getSelectedTextureSize() {
    const selectedRadio = document.querySelector('.texture-size-option input[type="radio"]:checked');
    if (selectedRadio) {
        return parseInt(selectedRadio.value);
    }
    return 256; // الحجم الافتراضي
}

// الدوال المساعدة
function toggleSideMenu() {
    const sideMenu = document.getElementById('side-menu');
    if (sideMenu) {
        sideMenu.classList.toggle('hidden');
    }
}

function toggleGrid() {
    if (sceneManager) {
        const isVisible = sceneManager.toggleGrid();
        const toggleGridBtn = document.getElementById('toggle-grid');
        const gridCheckbox = document.getElementById('grid-visible');
        
        if (toggleGridBtn) {
            toggleGridBtn.textContent = isVisible ? '#' : '#';
            toggleGridBtn.title = isVisible ? 'إخفاء الشبكة' : 'إظهار الشبكة';
        }
        
        if (gridCheckbox) {
            gridCheckbox.checked = isVisible;
        }
        
        localStorage.setItem('gridVisible', isVisible);
        sceneManager.showNotification(
            isVisible ? 'تم إظهار الشبكة' : 'تم إخفاء الشبكة',
            'info'
        );
    }
}

function toggleNotifications() {
    const notifications = document.getElementById('notifications');
    const toggleBtn = document.getElementById('toggle-notifications');
    
    if (notifications && toggleBtn) {
        if (notifications.classList.contains('hidden')) {
            notifications.classList.remove('hidden');
            toggleBtn.textContent = '🔔';
            toggleBtn.title = 'إخفاء الإشعارات';
        } else {
            notifications.classList.add('hidden');
            toggleBtn.textContent = '🔕';
            toggleBtn.title = 'إظهار الإشعارات';
        }
    }
}

function getShapeName(shapeType) {
    const names = {
        'cube': 'مكعب',
        'cylinder': 'أسطوانة',
        'sphere': 'كرة',
        'plane': 'لوح'
    };
    return names[shapeType] || shapeType;
}

function setupSliderControl(sliderId, valueId, onChange) {
    const slider = document.getElementById(sliderId);
    const valueDisplay = document.getElementById(valueId);
    
    if (slider && valueDisplay) {
        valueDisplay.textContent = slider.value;
        
        slider.addEventListener('input', (e) => {
            valueDisplay.textContent = e.target.value;
            if (onChange) {
                onChange(e.target.value);
            }
        });
    }
}

function updateObjectMaterial() {
    if (!sceneManager || !sceneManager.selectedObject) return;
    
    const color = document.getElementById('object-color')?.value || '#3498db';
    const roughness = parseFloat(document.getElementById('roughness')?.value || 0.5);
    const metalness = parseFloat(document.getElementById('metalness')?.value || 0);
    const opacity = parseFloat(document.getElementById('opacity')?.value || 1);
    
    sceneManager.updateObjectMaterial(color, roughness, metalness, opacity);
}

function setActiveControl(tool) {
    if (!sceneManager) return;
    
    sceneManager.setTransformMode(tool);
    
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

function handleTextureUpload(e) {
    const file = e.target.files[0];
    if (!file || !sceneManager) return;
    
    // التحقق من نوع الملف (JPG/PNG)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type.toLowerCase())) {
        sceneManager.showNotification('نوع الملف غير مدعوم. الرجاء استخدام JPG أو PNG فقط', 'error');
        return;
    }
    
    // التحقق من حجم الملف (حد أقصى 5MB)
    if (file.size > 5 * 1024 * 1024) {
        sceneManager.showNotification('حجم الملف كبير جداً (الحد الأقصى 5MB)', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const texture = new THREE.Texture(img);
            texture.needsUpdate = true;
            
            // تحديد حجم الخامة المطلوب
            const textureSize = getSelectedTextureSize();
            
            // تحسين حجم الـ Texture حسب الحجم المختار
            sceneManager.optimizeTexture(texture, textureSize);
            
            sceneManager.activeTexture = texture;
            sceneManager.textureSize = textureSize;
            
            const preview = document.getElementById('texture-preview');
            const previewImg = document.getElementById('texture-preview-img');
            const applyBtn = document.getElementById('apply-texture');
            
            if (preview && previewImg && applyBtn) {
                previewImg.src = event.target.result;
                preview.style.display = 'block';
                applyBtn.disabled = false;
                
                // إضافة معلومة حجم الخامة للمعاينة
                const sizeInfo = document.createElement('div');
                sizeInfo.style.marginTop = '5px';
                sizeInfo.style.fontSize = '11px';
                sizeInfo.style.color = 'var(--text-light)';
                sizeInfo.style.textAlign = 'center';
                sizeInfo.textContent = `الحجم: ${img.width}×${img.height} → ${textureSize}×${textureSize}`;
                
                // إزالة أي معلومة حجم سابقة
                const oldSizeInfo = preview.querySelector('.texture-size-info');
                if (oldSizeInfo) {
                    preview.removeChild(oldSizeInfo);
                }
                
                sizeInfo.className = 'texture-size-info';
                preview.appendChild(sizeInfo);
            }
            
            sceneManager.showNotification(`تم تحميل الخامة (${textureSize}×${textureSize})`, 'success');
        };
        img.onerror = function() {
            sceneManager.showNotification('خطأ في تحميل الصورة', 'error');
        };
        img.src = event.target.result;
    };
    reader.onerror = function() {
        sceneManager.showNotification('خطأ في قراءة الملف', 'error');
    };
    reader.readAsDataURL(file);
}

function applyTextureToObject() {
    if (!sceneManager || !sceneManager.activeTexture) {
        sceneManager.showNotification('لا يوجد خامة محملة', 'error');
        return;
    }
    
    if (!sceneManager.selectedObject) {
        sceneManager.showNotification('يجب تحديد كائن أولاً', 'error');
        return;
    }
    
    // الحصول على حجم الخامة المحدد
    const textureSize = getSelectedTextureSize();
    sceneManager.textureSize = textureSize;
    
    // تحديث معلومات التكرار الحالية
    const repeatU = parseInt(document.getElementById('texture-repeat-u').value);
    const repeatV = parseInt(document.getElementById('texture-repeat-v').value);
    
    sceneManager.applyTextureToObject(sceneManager.activeTexture, textureSize, repeatU, repeatV);
}

function handleFileImport(file) {
    if (!sceneManager) return;
    
    const fileName = file.name.toLowerCase();
    
    // التحقق من نوع الملف
    if (fileName.endsWith('.glb') || fileName.endsWith('.gltf')) {
        sceneManager.importFromGLTF(file);
    } else if (fileName.endsWith('.obj')) {
        sceneManager.importFromOBJ(file);
    } else {
        sceneManager.showNotification('نوع الملف غير مدعوم. الرجاء استخدام GLB, GLTF أو OBJ', 'error');
    }
}

function setupUIUpdates() {
    setInterval(() => {
        updateMemoryDisplay();
        updateUndoRedoButtons();
        updateSceneInfo();
    }, 1000);
}

function updateMemoryDisplay() {
    if (window.performance && window.performance.memory) {
        const usedMB = Math.round(window.performance.memory.usedJSHeapSize / 1024 / 1024);
        const memoryElement = document.getElementById('memory-usage');
        
        if (memoryElement) {
            memoryElement.textContent = usedMB;
        }
    }
}

function updateUndoRedoButtons() {
    if (!sceneManager) return;
    
    const undoBtnHud = document.getElementById('undo-btn-hud');
    const redoBtnHud = document.getElementById('redo-btn-hud');
    
    if (undoBtnHud) {
        undoBtnHud.disabled = sceneManager.historyIndex <= 0;
    }
    
    if (redoBtnHud) {
        redoBtnHud.disabled = sceneManager.historyIndex >= sceneManager.history.length - 1;
    }
}

function updateSceneInfo() {
    if (!sceneManager) return;
    
    const objectCount = document.getElementById('object-count');
    const importedCount = document.getElementById('imported-count');
    
    if (objectCount) {
        const regularObjects = sceneManager.objects.filter(obj => 
            obj.userData?.isNativeObject
        ).length;
        const importedObjects = sceneManager.importedObjects.length;
        const totalObjects = regularObjects + importedObjects;
        objectCount.textContent = totalObjects;
    }
    
    if (importedCount) {
        importedCount.textContent = sceneManager.importedObjects.length;
    }
}

function applyDefaultSettings() {
    // الوضع الداكن
    const darkMode = localStorage.getItem('darkMode') === 'true';
    const darkModeCheckbox = document.getElementById('dark-mode');
    if (darkModeCheckbox) {
        darkModeCheckbox.checked = darkMode;
    }
    
    if (sceneManager) {
        sceneManager.setTheme(darkMode);
    }
    
    // الشبكة
    const gridVisible = localStorage.getItem('gridVisible') !== 'false';
    const gridCheckbox = document.getElementById('grid-visible');
    if (gridCheckbox) {
        gridCheckbox.checked = gridVisible;
    }
    
    if (sceneManager) {
        sceneManager.gridVisible = gridVisible;
        if (sceneManager.grid) {
            sceneManager.grid.visible = gridVisible;
        }
        
        const toggleGridBtn = document.getElementById('toggle-grid');
        if (toggleGridBtn) {
            toggleGridBtn.textContent = gridVisible ? '#' : '#';
            toggleGridBtn.title = gridVisible ? 'إخفاء الشبكة' : 'إظهار الشبكة';
        }
    }
    
    // حجم الخامة
    const savedTextureSize = localStorage.getItem('textureSize');
    if (savedTextureSize) {
        const radioToSelect = document.querySelector(`.texture-size-option input[value="${savedTextureSize}"]`);
        if (radioToSelect) {
            radioToSelect.checked = true;
            const event = new Event('change');
            radioToSelect.dispatchEvent(event);
        }
    }
    
    // تحديث قيم السلايدرات
    updateSliderValues();
}

function updateSliderValues() {
    document.querySelectorAll('input[type="range"]').forEach(slider => {
        const valueDisplay = document.getElementById(slider.id + '-value');
        if (valueDisplay) {
            valueDisplay.textContent = slider.value;
        }
    });
}

// التحذير عند مغادرة الصفحة مع تغييرات غير محفوظة
window.addEventListener('beforeunload', (e) => {
    if (sceneManager && 
        (sceneManager.objects.length > 0 || sceneManager.importedObjects.length > 0)) {
        const message = 'يوجد تغييرات غير محفوظة. هل أنت متأكد من المغادرة؟';
        e.returnValue = message;
        return message;
    }
});

// إعادة تحميل الصفحة عند العودة من وضع الخلفية
window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
        location.reload();
    }
});

function showErrorPage(error) {
    const app = document.getElementById('app');
    if (app) {
        app.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                color: white;
                text-align: center;
                padding: 20px;
                direction: rtl;
            ">
                <h1 style="font-size: 3rem; margin-bottom: 20px;">⚠️ خطأ في التحميل</h1>
                <p style="font-size: 1.2rem; margin-bottom: 30px; max-width: 600px;">
                    حدث خطأ أثناء تحميل محرر الأشكال ثلاثي الأبعاد. يرجى تحديث الصفحة أو المحاولة لاحقاً.
                </p>
                <div style="
                    background: rgba(255, 255, 255, 0.1);
                    padding: 20px;
                    border-radius: 10px;
                    max-width: 600px;
                    margin-bottom: 30px;
                    text-align: left;
                    font-family: monospace;
                    font-size: 0.9rem;
                    overflow: auto;
                    max-height: 200px;
                ">
                    ${error.toString()}
                </div>
                <button onclick="location.reload()" style="
                    padding: 12px 30px;
                    font-size: 1.1rem;
                    background: white;
                    color: #667eea;
                    border: none;
                    border-radius: 50px;
                    cursor: pointer;
                    transition: transform 0.3s;
                ">
                    تحديث الصفحة
                </button>
            </div>
        `;
    }
}

// تحسينات للتجربة على الجوال
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    // إضافة تأخير لأزرار اللمس لتجنب النقرات المتعددة
    document.addEventListener('touchstart', (e) => {
        if (e.target.tagName === 'BUTTON') {
            e.target.style.opacity = '0.7';
        }
    }, { passive: true });
    
    document.addEventListener('touchend', (e) => {
        if (e.target.tagName === 'BUTTON') {
            e.target.style.opacity = '1';
        }
    }, { passive: true });
}

console.log('🚀 محرر الأشكال ثلاثي الأبعاد جاهز للاستخدام!');