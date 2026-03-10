class MapBuilder {
    static build(scene, floors, walls) {
        const T  = C.TILE;
        const WW = C.WORLD_W;
        const WH = C.WORLD_H;

        MapBuilder._makeTiles(scene);
        MapBuilder._drawBackground(scene, WW, WH);
        MapBuilder._drawLava(scene, WW, WH);

        const platforms = [];

        const F = (col, row, wide, tall = 1) => {
            for (let rr = 0; rr < tall; rr++) {
                for (let cc = 0; cc < wide; cc++) {
                    const t = floors.create((col + cc) * T + 8, (row + rr) * T + 8, 'floor');
                    t.setImmovable(true); t.refreshBody();
                }
            }
            platforms.push({ x: col * T, y: row * T, w: wide * T });
        };

        const WL = (col, row, tall) => {
            for (let rr = 0; rr < tall; rr++) {
                const t = walls.create(col * T + 8, (row + rr) * T + 8, 'wall');
                t.setImmovable(true); t.refreshBody();
            }
        };

        const LAVA_ROW = Math.floor(C.LAVA_Y / T);

        // LEFT SPAWN ZONE
        F(2,  LAVA_ROW - 4, 20);
        F(2,  LAVA_ROW - 16, 10);
        F(14, LAVA_ROW - 24, 8);
        WL(22, LAVA_ROW - 22, 18);
        WL(23, LAVA_ROW - 22, 18);

        // FIRST CROSSING
        F(26, LAVA_ROW - 8,  6);
        F(33, LAVA_ROW - 16, 5);
        F(40, LAVA_ROW - 26, 6);
        F(47, LAVA_ROW - 14, 5);
        WL(38, LAVA_ROW - 38, 30);
        WL(39, LAVA_ROW - 38, 30);

        // OPEN SKY ARENA
        WL(58, LAVA_ROW - 42, 36);
        WL(59, LAVA_ROW - 42, 36);
        WL(72, LAVA_ROW - 42, 36);
        WL(73, LAVA_ROW - 42, 36);
        WL(86, LAVA_ROW - 42, 36);
        WL(87, LAVA_ROW - 42, 36);
        F(55, LAVA_ROW - 12, 4);
        F(60, LAVA_ROW - 24, 5);
        F(68, LAVA_ROW - 18, 4);
        F(74, LAVA_ROW - 30, 5);
        F(80, LAVA_ROW - 22, 4);
        F(88, LAVA_ROW - 14, 5);
        F(62, LAVA_ROW - 38, 4);
        F(78, LAVA_ROW - 40, 4);

        // SLAB GAUNTLET
        WL(102, LAVA_ROW - 38, 32);
        WL(103, LAVA_ROW - 38, 32);
        WL(114, LAVA_ROW - 38, 32);
        WL(115, LAVA_ROW - 38, 32);
        WL(126, LAVA_ROW - 38, 32);
        WL(127, LAVA_ROW - 38, 32);
        WL(138, LAVA_ROW - 38, 32);
        WL(139, LAVA_ROW - 38, 32);
        F(104, LAVA_ROW - 10, 9);
        F(116, LAVA_ROW - 18, 9);
        F(128, LAVA_ROW - 10, 9);
        F(108, LAVA_ROW - 26, 5);
        F(120, LAVA_ROW - 32, 5);
        F(132, LAVA_ROW - 26, 5);

        // RIGHT LANDING PAD
        F(141, LAVA_ROW - 4, 7);

        return platforms;
    }

    static _makeTiles(scene) {
        let g = scene.make.graphics({ add: false });
        g.fillStyle(0x1a1a2c); g.fillRect(0, 0, 16, 16);
        g.fillStyle(0x2a2a44); g.fillRect(0, 0, 16, 2);
        g.fillStyle(0x22223a); g.fillRect(0, 2, 2, 14);
        g.lineStyle(1, 0x2e2e48, 1); g.strokeRect(0, 0, 16, 16);
        g.generateTexture('floor', 16, 16); g.destroy();

        g = scene.make.graphics({ add: false });
        g.fillStyle(0x10101c); g.fillRect(0, 0, 16, 16);
        g.fillStyle(0x1c1c2e); g.fillRect(1, 1, 14, 14);
        g.lineStyle(1, 0x222230, 1); g.strokeRect(0, 0, 16, 16);
        g.generateTexture('wall', 16, 16); g.destroy();
    }

    static _drawBackground(scene, w, h) {
        const g = scene.add.graphics().setDepth(-10);
        g.fillStyle(0x04040c); g.fillRect(0, 0, w, h);
        for (let i = 0; i < 200; i++) {
            const sx = Math.random() * w, sy = Math.random() * C.LAVA_Y;
            const sz = Math.random() < 0.15 ? 2 : 1;
            g.fillStyle(0xffffff, 0.1 + Math.random() * 0.4);
            g.fillRect(sx, sy, sz, sz);
        }
        g.lineStyle(1, 0x090916, 1);
        for (let x = 0; x < w; x += 48) g.lineBetween(x, 0, x, C.LAVA_Y);
        for (let y = 0; y < C.LAVA_Y; y += 48) g.lineBetween(0, y, w, y);
    }

    static _drawLava(scene, w, h) {
        const lavaY = C.LAVA_Y;
        const glow = scene.add.graphics().setDepth(-5);
        for (let i = 0; i < 60; i++) {
            glow.fillStyle(0xff4400, (1 - i / 60) * 0.12);
            glow.fillRect(0, lavaY - i * 3, w, 3);
        }
        const lava = scene.add.graphics().setDepth(-4);
        lava.fillStyle(0xff3300, 1); lava.fillRect(0, lavaY, w, h - lavaY);
        lava.fillStyle(0xff6600, 0.7); lava.fillRect(0, lavaY, w, 20);
        lava.fillStyle(0xff9900, 0.5); lava.fillRect(0, lavaY, w, 8);
        lava.fillStyle(0xffcc00, 0.35); lava.fillRect(0, lavaY, w, 3);
        for (let i = 0; i < 30; i++) {
            const bx = Math.random() * w;
            const by = lavaY + 8 + Math.random() * 20;
            const b  = scene.add.circle(bx, by, 3 + Math.random() * 8, 0xff6600, 0.6).setDepth(-3);
            scene.tweens.add({
                targets: b, y: by - 12 - Math.random() * 16, alpha: 0,
                duration: 600 + Math.random() * 1000,
                delay: Math.random() * 2000, repeat: -1,
                onRepeat: () => { b.y = by; b.alpha = 0.6; },
            });
        }
    }
}