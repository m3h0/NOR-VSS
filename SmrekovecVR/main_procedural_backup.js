

// Custom Raw WebGL Particle System to bypass broken external library
AFRAME.registerComponent('custom-particles', {
    schema: {
        count: { type: 'int', default: 1000 },
        color: { type: 'color', default: '#ffffff' },
        size: { type: 'number', default: 5 },
        speedY: { type: 'number', default: 20 },
        spreadX: { type: 'number', default: 10 },
        spreadZ: { type: 'number', default: 10 },
        maxAge: { type: 'number', default: 2 },
        opacity: { type: 'number', default: 1.0 }
    },
    init: function () {
        this.particleSystem = null;
    },
    update: function (oldData) {
        if (oldData.count === this.data.count && this.particleSystem) return;

        this.particleCount = this.data.count;

        if (this.particleSystem) {
            this.el.removeObject3D('particle-system');
        }

        if (this.particleCount === 0) return;

        this.particles = new THREE.BufferGeometry();
        const positions = new Float32Array(this.particleCount * 3);
        const ages = new Float32Array(this.particleCount);

        for (let i = 0; i < this.particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * this.data.spreadX;
            positions[i * 3 + 1] = Math.random() * this.data.speedY;
            positions[i * 3 + 2] = (Math.random() - 0.5) * this.data.spreadZ;
            ages[i] = Math.random() * this.data.maxAge;
        }

        this.particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.particles.setAttribute('age', new THREE.BufferAttribute(ages, 1));

        // Generate a soft radial gradient texture for the particles
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        const particleTexture = new THREE.CanvasTexture(canvas);

        this.material = new THREE.PointsMaterial({
            color: new THREE.Color(this.data.color),
            size: this.data.size,
            transparent: true,
            opacity: this.data.opacity,
            alphaMap: particleTexture,
            map: particleTexture,
            alphaTest: 0.01,
            blending: THREE.NormalBlending,
            depthWrite: false
        });

        this.particleSystem = new THREE.Points(this.particles, this.material);
        this.el.setObject3D('particle-system', this.particleSystem);
    },
    tick: function (time, timeDelta) {
        if (!this.particleSystem) return;

        const dt = timeDelta / 1000; // seconds
        const positions = this.particles.attributes.position.array;
        const ages = this.particles.attributes.age.array;

        for (let i = 0; i < this.particleCount; i++) {
            ages[i] += dt;

            // Move upwards
            positions[i * 3 + 1] += this.data.speedY * dt;

            // Slight horizontal drift
            positions[i * 3] += (Math.random() - 0.5) * 2 * dt;
            positions[i * 3 + 2] += (Math.random() - 0.5) * 2 * dt;

            // Reset particle if it exceeds max age
            if (ages[i] >= this.data.maxAge) {
                ages[i] = 0;
                positions[i * 3] = (Math.random() - 0.5) * this.data.spreadX;
                positions[i * 3 + 1] = 0; // Back to bottom
                positions[i * 3 + 2] = (Math.random() - 0.5) * this.data.spreadZ;
            }
        }

        this.particles.attributes.position.needsUpdate = true;
    }
});

// Custom Component for Reliable Ballistic Rock Physics
AFRAME.registerComponent('volcanic-rock', {
    schema: {
        target: { type: 'vec3', default: { x: 0, y: 0, z: 0 } },
        duration: { type: 'number', default: 2000 },
        delay: { type: 'number', default: 0 }
    },
    init: function () {
        this.isFlying = false;
        this.elapsed = 0;
        this.startTimer = 0;
        this.startY = 38;

        // Keep scale at 1 to prevent A-Frame bounding box computation errors
        this.el.setAttribute('scale', '1 1 1');
        this.el.setAttribute('position', `0 ${this.startY} 0`);

        // Hide securely using A-Frame state
        this.el.setAttribute('visible', 'false');

        // Force disable frustum culling when the mesh loads
        this.el.addEventListener('loaded', () => {
            const mesh = this.el.getObject3D('mesh');
            if (mesh) {
                mesh.frustumCulled = false;
            }
        });

        this.el.addEventListener('explode', () => {
            if (this.isFlying) return;
            this.isFlying = true;
            this.elapsed = 0;
            this.startTimer = 0;

            this.el.setAttribute('position', `0 ${this.startY} 0`);
            this.el.setAttribute('visible', 'true');
        });
    },
    tick: function (time, timeDelta) {
        if (!this.isFlying) return;

        this.startTimer += timeDelta;
        if (this.startTimer < this.data.delay) return;

        this.elapsed += timeDelta;
        const progress = Math.min(this.elapsed / this.data.duration, 1);

        // Ensure visible
        this.el.setAttribute('visible', 'true');

        // Quick scale up
        const s = Math.min(progress * 5, 1.5).toFixed(2);
        this.el.setAttribute('scale', `${s} ${s} ${s}`);

        // Spin wildly (degrees for A-Frame)
        const currentRot = this.el.getAttribute('rotation');
        this.el.setAttribute('rotation', `${currentRot.x + 5} ${currentRot.y + 8} ${currentRot.z + 6}`);

        // Arced ballistic movement
        const curX = 0 + (this.data.target.x - 0) * progress;
        const curZ = 0 + (this.data.target.z - 0) * progress;

        // Parabola Y
        const curY = this.startY + (this.data.target.y - this.startY) * progress + (Math.sin(progress * Math.PI) * 50);

        this.el.setAttribute('position', `${curX.toFixed(2)} ${curY.toFixed(2)} ${curZ.toFixed(2)}`);

        if (progress >= 1) {
            this.isFlying = false;
            this.el.setAttribute('visible', 'false'); // Hide on impact
            this.el.setAttribute('scale', '1 1 1');
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const vrWrapper = document.getElementById('vr-wrapper');
    const enterVrNav = document.getElementById('enter-vr-nav');
    const enterVrCta = document.getElementById('enter-vr-cta');
    const triggerHero = document.getElementById('trigger-eruption-hero');
    const exitVrBtn = document.getElementById('exit-vr-btn');
    let scene = null;
    let isErupting = false;
    let lavaPool, smokeParticles, magmaLight, ambientLight, dirLight, triggerBtnVR, rig;

    function generateLavaRivers() {
        let lavaHtml = '';
        const startAngles = [Math.PI / 2, Math.PI / 2 + 0.8, Math.PI / 2 - 0.8]; // Front, Left, Right
        const colors = ['#ff2200', '#ff1100', '#ff3300'];
        for (let r = 0; r < 3; r++) {
            let currentAngle = startAngles[r];

            // To make a flawless, bump-free river, we use overlapping flattened spheres rotated to match the slope exactly
            let prevY = 39;
            for (let y = 39; y >= -39; y -= 2.0) { // Larger step for smooth sphere segments
                const progressTop = (40 - prevY) / 80;
                const progressBot = (40 - y) / 80;

                const radiusTop = 15 + (100 - 15) * progressTop;
                const radiusBot = 15 + (100 - 15) * progressBot;

                currentAngle += (Math.random() - 0.5) * 0.08; // Organic winding

                // Float slightly above the surface to prevent Z-fighting
                const offsetTop = radiusTop + 0.5;
                const offsetBot = radiusBot + 0.5;

                // We use midY for the vertical position
                const midY = (prevY + y) / 2;
                // And midRadius for the exact outward offset from the central axis
                const midRadius = (offsetTop + offsetBot) / 2;

                // Massive, wide, continuous rivers of molten rock
                const riverWidth = 6.0 + (progressBot * 8.0);
                const radius = riverWidth / 2;

                // Delay the eruption flow animation based on how far down the mountain the segment is
                const delay = Math.round(progressBot * 5000) + (r * 200);

                // Convert math angle to A-Frame Y-rotation to spin the parent container
                const angleDeg = -(currentAngle * 180 / Math.PI) + 90;

                lavaHtml += `
                    <a-entity position="0 ${midY.toFixed(2)} 0" rotation="0 ${angleDeg.toFixed(2)} 0">
                        <a-sphere class="lava-segment" position="0 0 ${midRadius.toFixed(2)}" rotation="-46.5 0 0" radius="${radius.toFixed(2)}" scale="0.001 0.001 0.001" material="src: #magma; color: #ffffff; emissive: ${colors[r]}; emissiveIntensity: 2.5; roughness: 0.1" shadow="cast: false" animation__flow="property: scale; to: 1 1.5 0.2; dur: 800; delay: ${delay}; startEvents: trigger-lava; easing: easeOutQuad"></a-sphere>
                    </a-entity>`;

                prevY = y;
            }
        }
        return lavaHtml;
    }

    // Flying rocks feature has been removed as per user request due to browser rendering engine limitations.

    function generateSurfaceBoulders() {
        let bouldersHtml = '';
        const colors = ['#1A120E', '#221510', '#160D09', '#0a0a0a', '#2D1A12'];
        for (let i = 0; i < 75; i++) {
            const y = (Math.random() * 80) - 40; // Full slope from bottom (-40) to top (40)
            const progressBot = (40 - y) / 80;
            const radiusAtY = 15 + (100 - 15) * progressBot; // Interpolate radius

            const angle = Math.random() * Math.PI * 2;
            const dist = radiusAtY + (Math.random() * 1.5); // Flush against the surface, varied slightly outward
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;

            const size = 0.8 + Math.random() * 3.5;
            const rotX = Math.random() * 360;
            const rotY = Math.random() * 360;
            const rotZ = Math.random() * 360;
            const color = colors[Math.floor(Math.random() * colors.length)];

            bouldersHtml += `
                <a-dodecahedron position="${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}" rotation="${rotX.toFixed(2)} ${rotY.toFixed(2)} ${rotZ.toFixed(2)}" radius="${size.toFixed(2)}" material="src: #rock; color: ${color}; roughness: 1" shadow="cast: true"></a-dodecahedron>
            `;
        }
        return bouldersHtml;
    }

    function generatePterodactyls() {
        let pteroHtml = '';
        for (let i = 0; i < 7; i++) {
            const startAngle = Math.random() * 360;
            const yOffset = 50 + Math.random() * 30; // High above the volcano
            const radius = 20 + Math.random() * 50; // Circling radius
            const dur = 10000 + Math.random() * 10000;
            const flapDur = 200 + Math.random() * 100;
            const size = 0.4 + Math.random() * 0.4;

            pteroHtml += `
                <a-entity rotation="0 ${startAngle} 0" animation="property: rotation; to: 0 ${startAngle + 360} 0; loop: true; dur: ${dur}; easing: linear">
                    <a-entity position="0 ${yOffset.toFixed(2)} ${radius.toFixed(2)}" scale="${size.toFixed(2)} ${size.toFixed(2)} ${size.toFixed(2)}">
                        <a-entity rotation="0 -90 0">
                            <!-- Body -->
                            <a-cone radius-bottom="0.4" radius-top="0" height="2.5" rotation="90 0 0" material="color: #1a110d; roughness: 0.9"></a-cone>
                            <!-- Head/Beak -->
                            <a-cone radius-bottom="0.15" radius-top="0" height="1.8" position="0 0.2 -1.5" rotation="105 0 0" material="color: #241711; roughness: 0.9"></a-cone>
                            <!-- Left Wing -->
                            <a-entity position="-0.4 0.2 0" animation="property: rotation; to: 0 0 -45; dir: alternate; loop: true; dur: ${flapDur}">
                                <a-cone radius-bottom="1.2" radius-top="0" height="4" position="-2 0 0" rotation="0 0 90" scale="1 1 0.05" material="color: #1a110d; side: double"></a-cone>
                            </a-entity>
                            <!-- Right Wing -->
                            <a-entity position="0.4 0.2 0" animation="property: rotation; to: 0 0 45; dir: alternate; loop: true; dur: ${flapDur}">
                                <a-cone radius-bottom="1.2" radius-top="0" height="4" position="2 0 0" rotation="0 0 -90" scale="1 1 0.05" material="color: #1a110d; side: double"></a-cone>
                            </a-entity>
                        </a-entity>
                    </a-entity>
                </a-entity>
            `;
        }
        return pteroHtml;
    }

    function generateLavaCracks() {
        let cracksHtml = '';
        for (let i = 0; i < 15; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 80 + Math.random() * 60; // Spread around the base
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist;
            const rotY = -(angle * 180 / Math.PI) + 90 + (Math.random() * 20 - 10); // Point generally outward
            const width = 1 + Math.random() * 3;
            const length = 15 + Math.random() * 30;

            cracksHtml += `
                <a-plane class="lava-crack" position="${x.toFixed(2)} -4.9 ${z.toFixed(2)}" rotation="-90 ${rotY.toFixed(2)} 0" width="${width.toFixed(2)}" height="${length.toFixed(2)}" material="src: #magma; color: #ffffff; emissive: #ff2200; emissiveIntensity: 0.1" animation__glow="property: material.emissiveIntensity; to: ${2 + Math.random() * 2}; dur: ${1000 + Math.random() * 1000}; startEvents: trigger-cracks; easing: easeOutQuad" shadow="receive: true"></a-plane>
            `;
        }
        return cracksHtml;
    }

    function generateLavaBombs() {
        let bombsHtml = '';
        for (let i = 0; i < 25; i++) {
            const startX = (Math.random() - 0.5) * 100;
            const startZ = -70 + (Math.random() - 0.5) * 100;
            const startY = 150 + Math.random() * 100;

            const endX = startX + (Math.random() - 0.5) * 60;
            const endZ = startZ + (Math.random() - 0.5) * 60;
            const endY = -5; // Ground level

            const dur = 1500 + Math.random() * 2000;
            const delay = 4000 + Math.random() * 15000; // Rain down over 15 seconds during eruption

            // Leave a glowing crater impact on the ground
            bombsHtml += `
                <a-circle position="${endX.toFixed(2)} -4.8 ${endZ.toFixed(2)}" rotation="-90 0 0" radius="1.5" material="src: #magma; color: #ffffff; emissive: #ff2200; emissiveIntensity: 0.1" animation__craterglow="property: material.emissiveIntensity; to: 3; delay: ${delay + dur}; dur: 300; startEvents: trigger-bombs" shadow="receive: true"></a-circle>
            `;

            // Falling bomb without expensive particles, hiding itself on impact
            bombsHtml += `
                <a-entity class="lava-bomb" position="${startX.toFixed(2)} ${startY.toFixed(2)} ${startZ.toFixed(2)}" visible="false" animation__drop="property: position; to: ${endX.toFixed(2)} ${endY} ${endZ.toFixed(2)}; dur: ${dur}; delay: ${delay}; startEvents: trigger-bombs; easing: easeInQuad" animation__show="property: visible; to: true; delay: ${delay}; startEvents: trigger-bombs" animation__hide="property: visible; to: false; delay: ${delay + dur}; startEvents: trigger-bombs">
                    <a-dodecahedron radius="2" material="src: #magma; color: #ffffff; emissive: #ff4400; emissiveIntensity: 3" animation="property: rotation; to: ${Math.random() * 720} ${Math.random() * 720} ${Math.random() * 720}; dur: ${dur}; loop: true; easing: linear"></a-dodecahedron>
                    <a-entity light="type: point; color: #ff3300; intensity: 2; distance: 30"></a-entity>
                </a-entity>
            `;
        }
        return bombsHtml;
        return bombsHtml;
    }

    function createRealisticPine(x, y, z, scale) {
        // High fidelity PBR-textured open-ended "skirt" branches for maximum realism without models
        const rotY = Math.random() * 360;
        const tiltX = (Math.random() - 0.5) * 8;
        const tiltZ = (Math.random() - 0.5) * 8;
        return `
            <a-entity position="${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}" rotation="${tiltX.toFixed(1)} ${rotY.toFixed(2)} ${tiltZ.toFixed(1)}" scale="${scale.toFixed(2)} ${scale.toFixed(2)} ${scale.toFixed(2)}" shadow="cast: true; receive: true">
                <!-- Extremely detailed rigid trunk -->
                <a-cylinder radius="0.35" height="4.5" position="0 2.25 0" material="src: #pine-bark; color: #6e5546; roughness: 1; repeat: 1 4" shadow="cast: true"></a-cylinder>
                
                <!-- Drooping, open-ended skirt layers for sweeping branch realism (textured inside and out) -->
                <a-cone radius-bottom="3.8" radius-top="0.4" height="2.5" position="0 3.5 0" open-ended="true" side="double" material="src: #pine-needles; color: #182a17; roughness: 0.9; repeat: 4 2" shadow="cast: true; receive: true"></a-cone>
                <a-cone radius-bottom="3.4" radius-top="0.3" height="2.5" position="0 5.0 0" open-ended="true" side="double" material="src: #pine-needles; color: #1e331c; roughness: 0.9; repeat: 4 2" shadow="cast: true; receive: true"></a-cone>
                <a-cone radius-bottom="2.9" radius-top="0.2" height="2.5" position="0 6.5 0" open-ended="true" side="double" material="src: #pine-needles; color: #233b21; roughness: 0.9; repeat: 3 2" shadow="cast: true; receive: true"></a-cone>
                <a-cone radius-bottom="2.4" radius-top="0.1" height="2.5" position="0 8.0 0" open-ended="true" side="double" material="src: #pine-needles; color: #294427; roughness: 0.9; repeat: 3 2" shadow="cast: true; receive: true"></a-cone>
                <a-cone radius-bottom="1.8" radius-top="0.1" height="2.5" position="0 9.5 0" open-ended="true" side="double" material="src: #pine-needles; color: #2e4d2c; roughness: 0.9; repeat: 2 1" shadow="cast: true; receive: true"></a-cone>
                <a-cone radius-bottom="1.2" radius-top="0.0" height="2.5" position="0 11.0 0" open-ended="true" side="double" material="src: #pine-needles; color: #355632; roughness: 0.9; repeat: 2 1" shadow="cast: true; receive: true"></a-cone>
                <!-- Cap the top to conceal the tiny top hole -->
                <a-cone radius-bottom="0.8" radius-top="0" height="2" position="0 12.5 0" material="src: #pine-needles; color: #3b6038; roughness: 0.9; repeat: 1 1" shadow="cast: true; receive: true"></a-cone>
            </a-entity>
        `;
    }

    function generateForest() {
        let pinesHtml = '';

        // Background dense forest
        for (let i = 0; i < 200; i++) {
            const x = (Math.random() - 0.5) * 200;
            const z = 20 + Math.random() * 80;
            const y = (Math.random() * 2) - 4;
            const scale = 0.5 + Math.random() * 2.0;
            const rotY = Math.random() * 360;

            pinesHtml += createRealisticPine(x, y, z, scale);
        }

        // Volcano surrounding trees (scattered wide)
        for (let i = 0; i < 450; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 35 + Math.random() * 120; // 35 to 155 away
            const x = Math.cos(angle) * dist;
            const z = Math.sin(angle) * dist - 70; // centered on volcano
            // Check distance to volcano center (0, -70)
            const distToVolcano = Math.sqrt(x * x + (z + 70) * (z + 70));

            // Skip trees that would spawn inside the volcano cone geometry radius (< 85)
            // or on the wooden viewing platform
            if (distToVolcano < 85 || (z > -10 && z < 20 && x > -20 && x < 20)) continue;

            const y = (Math.random() * 2) - 4;
            const scale = 0.5 + Math.random() * 2.0;
            const rotY = Math.random() * 360;

            pinesHtml += createRealisticPine(x, y, z, scale);
        }
        return pinesHtml;
    }

    // Glowing map rocks feature removed per user request

    function triggerEruption() {
        if (isErupting) return;
        isErupting = true;

        const segments = scene.querySelectorAll('.lava-segment');

        // Stage 1: Initial Rumble & Smoke Build-up (0 seconds)
        // Darken environment slightly and fade sky to dark red
        ambientLight.setAttribute('light', 'color: #0A0200; intensity: 0.3');
        dirLight.setAttribute('light', 'color: #ff2200; intensity: 1.5');

        const env = document.querySelector('[environment]');
        if (env) {
            // Transition the procedural sky and horizon to dark volcanic red over 8 seconds
            env.setAttribute('animation__sky', 'property: environment.skyColor; to: #1A0505; dur: 8000; easing: easeInOutSine');
            env.setAttribute('animation__horizon', 'property: environment.horizonColor; to: #4A0A00; dur: 8000; easing: easeInOutSine');
        }

        // Start building smoke
        if (smokeParticles) {
            smokeParticles.setAttribute('custom-particles', { count: 400, size: 20, speedY: 5, opacity: 0.6 });
        }

        // Start massive rumble sound
        const volcanoSound = document.getElementById('volcano-sound');
        if (volcanoSound && volcanoSound.components.sound) {
            volcanoSound.components.sound.playSound();
        }

        // Stage 2: Eruption Core Ignites (2.5 seconds)
        setTimeout(() => {
            if (smokeParticles) smokeParticles.setAttribute('custom-particles', { count: 1200, size: 45, speedY: 25, opacity: 0.95 });
            if (fireParticles1) fireParticles1.setAttribute('custom-particles', { count: 1500 });
            if (fireParticles2) fireParticles2.setAttribute('custom-particles', { count: 800 });

            // Magma pool glow spikes
            lavaPool.setAttribute('animation__emissive', { property: 'material.emissiveIntensity', from: 1, to: 6, dur: 500 });
            magmaLight.setAttribute('light', 'intensity: 15; distance: 500');

        }, 2500);

        // Stage 3: Lava Flow & Violent Shake (3.5 seconds)
        setTimeout(() => {
            // Trigger the lava geometric flow down the mountain
            segments.forEach(seg => {
                seg.emit('trigger-lava');
            });

            // Trigger glowing cracks
            scene.querySelectorAll('.lava-crack').forEach(el => el.emit('trigger-cracks'));

            // Trigger falling lava bombs
            scene.querySelectorAll('.lava-bomb').forEach(el => el.emit('trigger-bombs'));

            // VR-Safe Environmental Shake: Shake the world, not the camera
            const envElements = [
                document.getElementById('volcano-core'),
                document.getElementById('lava-pool'),
                document.getElementById('fire-particles-1'),
                document.getElementById('fire-particles-2'),
                document.getElementById('smoke-particles')
            ];

            envElements.forEach(el => {
                if (el) {
                    const originalPos = el.getAttribute('position');
                    // Store original position to wipe out drift
                    const magnitude = 0.5;
                    const offsetX = (Math.random() * magnitude * 2) - magnitude;
                    const offsetZ = (Math.random() * magnitude * 2) - magnitude;
                    el.setAttribute('animation__shake', `property: position; to: ${originalPos.x + offsetX} ${originalPos.y} ${originalPos.z + offsetZ}; dir: alternate; dur: 45; loop: 150`);
                }
            });

            dirLight.setAttribute('light', 'color: #ff2200; intensity: 3');
        }, 3500);

        // Stage 4: Reset the environment slowly after 16 seconds
        setTimeout(() => {
            isErupting = false;
            ambientLight.setAttribute('light', 'color: #2B2335; intensity: 0.6');
            dirLight.setAttribute('light', 'color: #FF9944; intensity: 3');
            lavaPool.setAttribute('material', 'emissiveIntensity: 1');
            magmaLight.setAttribute('light', 'intensity: 1');

            if (fireParticles1) fireParticles1.setAttribute('custom-particles', { count: 0 });
            if (fireParticles2) fireParticles2.setAttribute('custom-particles', { count: 0 });
            if (smokeParticles) smokeParticles.setAttribute('custom-particles', { count: 150, size: 15, speedY: 2, opacity: 0.3 });

            // Hide lava streams by scaling X/Y back to microscopic size (0.001) instead of exact 0 to prevent singular matrix culling
            segments.forEach(seg => {
                seg.setAttribute('scale', '0.001 0.001 1');
                seg.removeAttribute('animation__flow');
                // Restore animation component for next time
                const delay = seg.getAttribute('animation__flow_delay') || 0; // We will just rely on it snapping back for now
                seg.setAttribute('animation__flow', `property: scale; to: 1 1 1; dur: 800; delay: ${seg._flowDelay || 0}; startEvents: trigger-lava; easing: easeOutQuad`);
            });

            // Stop environmental shake and restore original positions

            // Reset rocks
            const rocks = scene.querySelectorAll('.flying-rock');
            rocks.forEach(rock => {
                rock.setAttribute('visible', 'false');
                rock.setAttribute('position', '0 38 0');
            });

            const envElements = [
                document.getElementById('volcano-core'),
                document.getElementById('lava-pool'),
                document.getElementById('fire-particles-1'),
                document.getElementById('fire-particles-2'),
                document.getElementById('smoke-particles')
            ];
            envElements.forEach(el => {
                if (el) {
                    el.removeAttribute('animation__shake');
                    if (el._origPos) el.setAttribute('position', el._origPos);
                }
            });

        }, 16000);
    } function buildVRScene() {
        if (scene) return; // Already built

        const timestamp = Date.now();
        const sceneHtml = `
            <a-scene embedded renderer="colorManagement: true; physicallyCorrectLights: true; antialias: true;" style="width: 100vw; height: 100vh;" vr-mode-ui="enabled: true" fog="type: exponential; color: #170A04; density: 0.04">
                
                <a-assets>
                    <img id="wood" src="https://images.unsplash.com/photo-1550684376-efcbd6e3f031?q=80&w=1024&auto=format&fit=crop&t=${timestamp}" crossorigin="anonymous">
                    <img id="pine-bark" src="https://images.unsplash.com/photo-1596400305713-33bc9ca31ec2?q=80&w=1024&auto=format&fit=crop&t=${timestamp}" crossorigin="anonymous">
                    <img id="pine-needles" src="https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=1024&auto=format&fit=crop&t=${timestamp}" crossorigin="anonymous">
                    <img id="smrekovec-today" src="/smrekovec-today.jpg" crossorigin="anonymous">
                    <img id="rock" src="https://images.unsplash.com/photo-1525926477800-7a3ddfaee5a0?q=80&w=1024&auto=format&fit=crop&t=${timestamp}" crossorigin="anonymous">
                    <img id="magma" src="https://images.unsplash.com/photo-1616790875938-160fa1f974eb?q=80&w=1024&auto=format&fit=crop&t=${timestamp}" crossorigin="anonymous">
                    <img id="obsidian" src="https://images.unsplash.com/photo-1602492196414-9b5db84de2a5?q=80&w=1024&auto=format&fit=crop&t=${timestamp}" crossorigin="anonymous">
                    <audio id="eruption-rumble" src="/eruption.mp3" preload="auto" crossorigin="anonymous"></audio>
                </a-assets>

                <!-- Cinematic Environment Settings -->
                <a-entity environment="
                    preset: forest; 
                    seed: 9918; 
                    skyType: atmosphere; 
                    skyColor: #120914; 
                    horizonColor: #4A1A05; 
                    lighting: none; 
                    ground: hills;
                    groundYScale: 25; 
                    groundColor: #0D0F0A; 
                    groundColor2: #050503; 
                    dressing: none;
                    grid: none">
                </a-entity>

                <!-- Ultra-Realistic Lighting -->
                <a-entity id="ambient-light" light="type: ambient; color: #2B2335; intensity: 0.6"></a-entity>
                <a-entity id="directional-light" light="type: directional; color: #FF9944; intensity: 3; castShadow: true; shadowMapHeight: 2048; shadowMapWidth: 2048; shadowCameraRight: 50; shadowCameraLeft: -50; shadowCameraTop: 50; shadowCameraBottom: -50; shadowBias: -0.001" position="-30 40 -10"></a-entity>
                <a-entity id="magma-light" light="type: point; color: #ff2200; intensity: 1; distance: 200; castShadow: true" position="0 40 -60"></a-entity>

                <!-- Dramatic Background Boulders & Meshes -->
                <!-- Distant Giant Volcanic Outcroppings -->
                <a-entity position="-45 -5 -35">
                    <a-dodecahedron radius="15" material="src: #rock; color: #221510; roughness: 0.9; repeat: 4 4" shadow="cast: true"></a-dodecahedron>
                    <a-dodecahedron radius="12" position="20 -8 5" material="src: #obsidian; color: #111; roughness: 0.5; repeat: 3 3"></a-dodecahedron>
                    <a-dodecahedron radius="20" position="-10 5 -15" material="src: #rock; color: #1A120E; roughness: 1; repeat: 5 5"></a-dodecahedron>
                </a-entity>
                <a-entity position="55 -10 -30" rotation="0 65 0">
                    <a-dodecahedron radius="25" material="src: #rock; color: #2D1A12; roughness: 1; repeat: 4 4" shadow="cast: true"></a-dodecahedron>
                    <a-sphere radius="15" position="-10 -5 10" material="src: #obsidian; color: #0a0a0a; roughness: 0.7"></a-sphere>
                </a-entity>
                
                <!-- Immediate Platform Boulder Clusters (Massive Density) -->
                <a-entity position="0 0 0">
                    <!-- Left Side Rock Field -->
                    <a-dodecahedron radius="3" position="-8 -0.5 -2" material="src: #rock; color: #1F1B19; roughness: 1; repeat: 2 2" shadow="cast: true"></a-dodecahedron>
                    <a-dodecahedron radius="1.5" position="-6 -0.1 1" material="src: #obsidian; color: #222; roughness: 0.6" shadow="cast: true"></a-dodecahedron>
                    <a-sphere radius="2.5" position="-10 -0.8 4" material="src: #rock; color: #141211; roughness: 0.9" shadow="cast: true"></a-sphere>
                    <a-dodecahedron radius="2" position="-12 -0.2 -1" rotation="15 45 0" material="src: #rock; color: #160D09; roughness: 1" shadow="cast: true"></a-dodecahedron>
                    <a-sphere radius="1.2" position="-7 -0.5 5" material="src: #obsidian; color: #1a1a1a; roughness: 0.5" shadow="cast: true"></a-sphere>
                    <a-dodecahedron radius="4.5" position="-15 -1.5 8" material="src: #rock; color: #1C120D; roughness: 1; repeat: 3 3" shadow="cast: true"></a-dodecahedron>

                    <!-- Right Side Rock Field -->
                    <a-dodecahedron radius="4" position="7 -1 -4" rotation="0 35 15" material="src: #rock; color: #221510; roughness: 1; repeat: 3 3" shadow="cast: true"></a-dodecahedron>
                    <a-sphere radius="1.8" position="9 0 -1" material="src: #obsidian; color: #1a1a1a; roughness: 0.4" shadow="cast: true"></a-sphere>
                    <a-dodecahedron radius="2.2" position="5 -0.5 4" rotation="45 0 0" material="src: #rock; color: #1A120E; roughness: 0.9" shadow="cast: true"></a-dodecahedron>
                    <a-sphere radius="3.5" position="12 -1 3" material="src: #rock; color: #141211; roughness: 1" shadow="cast: true"></a-sphere>
                    <a-dodecahedron radius="1.5" position="10 -0.2 -5" material="src: #obsidian; color: #111; roughness: 0.7" shadow="cast: true"></a-dodecahedron>
                    <a-dodecahedron radius="5" position="16 -2 7" rotation="0 60 10" material="src: #rock; color: #160D09; roughness: 1; repeat: 3 3" shadow="cast: true"></a-dodecahedron>
                    
                    <!-- Behind Platform Rock Wall -->
                    <a-dodecahedron radius="5" position="-3 -1.5 8" rotation="10 45 0" material="src: #rock; color: #160D09; roughness: 1; repeat: 4 4" shadow="cast: true"></a-dodecahedron>
                    <a-dodecahedron radius="3.5" position="4 -1 10" material="src: #rock; color: #1C120D; roughness: 0.9" shadow="cast: true"></a-dodecahedron>
                    <a-sphere radius="2" position="0 -0.5 6" material="src: #obsidian; color: #222; roughness: 0.5" shadow="cast: true"></a-sphere>
                    <a-dodecahedron radius="4" position="-8 -1.2 12" rotation="20 0 15" material="src: #rock; color: #1A120E; roughness: 1; repeat: 2 2" shadow="cast: true"></a-dodecahedron>
                    <a-sphere radius="2.8" position="9 -0.8 11" material="src: #rock; color: #141211; roughness: 0.9" shadow="cast: true"></a-sphere>
                    
                    <!-- Glowing Terrain Cracks -->
${generateLavaCracks()}

                    <!-- Falling Lava Bombs -->
${generateLavaBombs()}
                </a-entity>
                
                <!-- Background Ancient Forest -->
                <a-entity id="ancient-forest">
${generateForest()}
                </a-entity>
                
                <!-- Mid-ground Pathway Rocks towards Volcano -->
                <a-entity position="0 -1 -20">
                    <a-dodecahedron radius="6" position="-15 -2 0" material="src: #obsidian; color: #0f0f0f; roughness: 0.7; repeat: 2 2" shadow="cast: true"></a-dodecahedron>
                    <a-sphere radius="4" position="-12 -1 -5" material="src: #rock; color: #1F1B19; roughness: 1" shadow="cast: true"></a-sphere>
                    <a-dodecahedron radius="8" position="18 -3 -2" rotation="0 75 0" material="src: #rock; color: #141211; roughness: 1; repeat: 3 3" shadow="cast: true"></a-dodecahedron>
                </a-entity>

                <!-- Realistic Volcano Geometry -->
                <a-entity id="volcano-core" position="0 -5 -70">
                    <!-- Base Mountain -->
                    <a-cone radius-bottom="100" radius-top="15" height="80" material="src: #rock; color: #160D09; roughness: 0.95; repeat: 12 12" shadow="cast: true; receive: true"></a-cone>
                    
                    <!-- Organic Programmatic Lava Flows -->
${generateLavaRivers()}
                    
                    <!-- Surface Boulders to make volcano jagged -->
${generateSurfaceBoulders()}
                    
                    <!-- Circling Pterodactyls -->
${generatePterodactyls()}
                    
                    <!-- Magma Pools at the base -->
                    <a-circle position="0 -39.9 85" rotation="-90 0 0" radius="15" material="src: #magma; color: #ffffff; emissive: #ff2200; emissiveIntensity: 1.5; repeat: 2 2" shadow="receive: true"></a-circle>
                    <a-circle position="-50 -39.9 70" rotation="-90 0 0" radius="10" material="src: #magma; color: #ffffff; emissive: #ff2200; emissiveIntensity: 1; repeat: 2 2" shadow="receive: true"></a-circle>
                    <a-circle position="50 -39.9 75" rotation="-90 0 0" radius="12" material="src: #magma; color: #ffffff; emissive: #ff3300; emissiveIntensity: 2; repeat: 2 2" shadow="receive: true"></a-circle>

                    <!-- Crater Rim -->
                    <a-cylinder position="0 40 0" radius="15" height="3" material="src: #obsidian; color: #050302; roughness: 0.8; repeat: 2 1" shadow="cast: true"></a-cylinder>
                    
                    <!-- 3D Spatial Audio Eruption Rumble -->
                    <a-entity id="volcano-sound" sound="src: #eruption-rumble; autoplay: false; loop: true; volume: 8; distanceModel: exponential; refDistance: 10; maxDistance: 10000; rolloffFactor: 1" position="0 40 0"></a-entity>

                    <!-- Lava Pool & Emissive Glow -->
                    <a-circle id="lava-pool" position="0 40.5 0" rotation="-90 0 0" radius="14" material="src: #magma; color: #ffffff; emissive: #ff2200; emissiveIntensity: 1; repeat: 3 3"></a-circle>
                    
                    <!-- Dense Custom Particle Systems (Replacing broken external library with raw Three.js) -->
                    <!-- Eruption Fire (Starts at 0, roars on trigger) -->
                    <a-entity id="fire-particles-1" position="0 42 0" custom-particles="count: 0; color: #ff3300; size: 8; speedY: 30; spreadX: 12; spreadZ: 12; maxAge: 2"></a-entity>
                    <a-entity id="fire-particles-2" position="0 45 0" custom-particles="count: 0; color: #ff8800; size: 5; speedY: 40; spreadX: 8; spreadZ: 8; maxAge: 1.5"></a-entity>
                    
                    <!-- Thick Billowing Smoke (Starts empty, thickens on trigger) -->
                    <a-entity id="smoke-particles" position="0 50 0" custom-particles="count: 0; color: #444444; size: 30; speedY: 15; spreadX: 30; spreadZ: 30; maxAge: 10; opacity: 0.8"></a-entity>
                    
                    <!-- Passive Glowing Embers drifting around the crater constantly -->
                    <a-entity position="0 42 0" custom-particles="count: 0; color: #ffaa00; size: 2; speedY: 8; spreadX: 20; spreadZ: 20; maxAge: 5"></a-entity>
                </a-entity>

                <!-- Floating Atmospheric Embers near platform -->
                <a-entity position="0 5 -5" custom-particles="count: 0; color: #ffcc00; size: 0.15; speedY: 0.5; spreadX: 10; spreadZ: 10; maxAge: 8; opacity: 0.4"></a-entity>

                <!-- Floating Educational Card -->
                <a-entity position="-6 2.5 -6" look-at="#camera">
                    <a-plane width="3.2" height="4.2" color="#1a110d" material="roughness: 0.8" shadow="cast: true"></a-plane>
                    
                    <!-- Image -->
                    <a-image src="#smrekovec-today" width="2.8" height="2" position="0 0.8 0.05"></a-image>
                    
                    <!-- Title -->
                    <a-text value="SMREKOVEC DANES" align="center" position="0 -0.5 0.05" width="3" color="#f46a25" font="kelsonsans" shadow="cast: true"></a-text>
                    
                    <!-- Description -->
                    <a-text value="Nekoc ognjeni podmorski vulkan je Smrekovec danes mirno zatocisce, znano po bogati alpski flori, gostih gozdovih in edinstveni geoloski zgodovini. Predstavlja edino vulkansko pogorje v Kamnisko-Savinjskih Alpah in ponuja prelepe razglede ter neokrnjeno naravo vsem, ki ga raziskujejo." 
                            align="center" position="0 -0.8 0.05" width="2.6" baseline="top" wrap-count="35" color="#dddddd" shadow="cast: true"></a-text>
                </a-entity>

                <!-- Detailed Viewing Platform -->
                <!-- Extremely Dense & Colorful Forest Around Volcano Base -->
                <a-entity position="0 -2 -30">
                    
                    <!-- Extra Dense Surrounding Trees (Volcano context - High Realism Pine Cones) -->
                    ${createRealisticPine(-50, 3, 10, 2.5)}
                    ${createRealisticPine(75, 4, -25, 3.0)}
                    ${createRealisticPine(-30, 2, 25, 2.0)}

                    <!-- Vibrant Fallen Logs and Rocks (Near Volcano Base) -->
                    <a-cylinder position="-20 1 18" rotation="0 65 90" radius="0.45" height="7" material="src: #wood; color: #423232; roughness: 1; repeat: 1 4" shadow="cast: true; receive: true"></a-cylinder>
                    <a-dodecahedron radius="1.2" position="-18 0.8 17.5" material="src: #rock; color: #4A5C43; roughness: 1" shadow="cast: true"></a-dodecahedron>
                    <a-dodecahedron radius="0.8" position="-20 0.5 19" material="src: #rock; color: #354230; roughness: 1" shadow="cast: true"></a-dodecahedron>
                    <a-dodecahedron radius="1.5" position="25 0.5 22" material="src: #rock; color: #2C3627; roughness: 1" shadow="cast: true"></a-dodecahedron>
                </a-entity>

                <a-entity position="0 0.2 -5">                    
                    <!-- Advanced Trigger Console Pillar -->
                    <a-box position="0 0.8 -3.2" width="1.2" height="1.6" depth="0.8" material="src: #wood; color: #2A1A15; repeat: 1 2" shadow="cast: true"></a-box>
                    
                    <!-- Beveled Console Face -->
                    <a-box class="clickable" position="0 1.6 -3.2" rotation="25 0 0" width="1.4" height="0.2" depth="1" material="src: #obsidian; color: #222" shadow="cast: true"></a-box>
                    
                    <a-entity id="trigger-btn" position="0 1.7 -3.2" rotation="25 0 0">
                        <a-cylinder id="trigger-btn-mesh" class="clickable" radius="0.4" height="0.1" color="#ff1100" material="emissive: #aa0000; emissiveIntensity: 0.5; roughness: 0.2" shadow="cast: true"
                            animation__hover="property: material.emissiveIntensity; type: color; startEvents: mouseenter; to: 2; dur: 200"
                            animation__leave="property: material.emissiveIntensity; type: color; startEvents: mouseleave; to: 0.5; dur: 200"
                            animation__press="property: position; startEvents: mousedown; to: 0 -0.05 0; dur: 100"
                            animation__release="property: position; startEvents: mouseup; to: 0 0 0; dur: 100">
                        </a-cylinder>
                        
                        <!-- Instructional Floating Text Card Above the Button -->
                        <a-entity position="0 0.8 0" rotation="-25 0 0" look-at="#camera">
                            <a-plane width="3.5" height="0.5" color="#1a110d" material="roughness: 0.8" shadow="cast: true"></a-plane>
                            <a-text value="GLEJTE GUMB 2 SEKUNDI" align="center" position="0 0 0.05" width="4" color="#f46a25" font="kelsonsans" shadow="cast: true"></a-text>
                        </a-entity>
                    </a-entity>
                </a-entity>

                <!-- Shake Container isolates the camera from absolute world coordinates -->
                <a-entity id="shake-container" position="0 0 0">
                    <a-entity id="rig" position="0 1.6 -1">
                        <a-camera id="camera" look-controls wasd-controls="acceleration: 20">
                            <a-cursor fuse="true" fuseTimeout="1500" color="#fff" raycaster="objects: .clickable" animation__click="property: scale; startEvents: click; easing: easeInCubic; dur: 150; from: 0.1 0.1 0.1; to: 1 1 1" animation__fusing="property: scale; startEvents: fusing; easing: easeInCubic; dur: 1500; from: 1 1 1; to: 0.1 0.1 0.1"></a-cursor>
                        </a-camera>
                        <a-entity laser-controls="hand: left" raycaster="objects: .clickable"></a-entity>
                        <a-entity laser-controls="hand: right" raycaster="objects: .clickable"></a-entity>
                    </a-entity>
                </a-entity>
            </a-scene>
        `;

        vrWrapper.insertAdjacentHTML('beforeend', sceneHtml);
        scene = document.querySelector('a-scene');
        exitVrBtn.style.display = 'block';

        // Wait a frame for DOM to flush
        setTimeout(() => {
            lavaPool = document.getElementById('lava-pool');
            smokeParticles = document.getElementById('smoke-particles');
            magmaLight = document.getElementById('magma-light');
            ambientLight = document.getElementById('ambient-light');
            dirLight = document.getElementById('directional-light');
            triggerBtnVR = document.getElementById('trigger-btn-mesh');
            rig = document.getElementById('rig');

            if (triggerBtnVR) {
                triggerBtnVR.addEventListener('mousedown', triggerEruption);
                triggerBtnVR.addEventListener('click', triggerEruption);
            }

            scene.addEventListener('exit-vr', () => {
                closeVR();
            });

            scene.resize();

            // Force focus on the canvas so WASD works immediately
            const canvas = scene.canvas;
            if (canvas) {
                canvas.focus();
                // When clicking anywhere on the canvas, ensure it stays focused
                canvas.addEventListener('click', () => canvas.focus());
            }
        }, 100);
    }

    function openVR() {
        vrWrapper.className = 'vr-active';
        buildVRScene();
    }

    function closeVR() {
        vrWrapper.className = 'vr-hidden';
        if (scene && scene.is('vr-mode')) {
            scene.exitVR();
        }

        // Teardown scene to save memory
        if (scene) {
            scene.remove();
            scene = null;
            exitVrBtn.style.display = 'none';
        }
    }

    // Ensure event listeners point to the global triggerEruption function defined at the top

    if (enterVrNav) enterVrNav.addEventListener('click', openVR);
    if (enterVrCta) enterVrCta.addEventListener('click', openVR);
    if (triggerHero) triggerHero.addEventListener('click', () => {
        openVR();
        setTimeout(triggerEruption, 1000); // Give it a sec to load the scene before erupting
    });

    if (exitVrBtn) exitVrBtn.addEventListener('click', closeVR);
});

// Trigger HMR refresh
