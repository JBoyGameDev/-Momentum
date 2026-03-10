class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }

    create() {
        const { width: W, height: H } = this.scale;
        this.add.rectangle(W / 2, H / 2, W, H, 0x04040c);
        const g = this.add.graphics();
        g.lineStyle(1, 0x0c0c20, 1);
        for (let x = 0; x < W; x += 48) g.lineBetween(x, 0, x, H);
        for (let y = 0; y < H; y += 48) g.lineBetween(0, y, W, y);

        this.add.text(W / 2, 52, 'MOMENTUM', {
            fontSize: '28px', color: '#d4d0c8', fontFamily: 'monospace',
            stroke: '#000', strokeThickness: 6, letterSpacing: 8,
        }).setOrigin(0.5);
        this.add.text(W / 2, 90, 'select your weapon', {
            fontSize: '8px', color: '#2a2a4a', fontFamily: 'monospace', letterSpacing: 4,
        }).setOrigin(0.5);

        const weapons  = Object.values(C.WEAPONS);
        const cardW    = 160, cardH = 200;
        const total    = weapons.length;
        const spacing  = Math.min(180, (W - 60) / total);
        const startX   = W / 2 - spacing * (total - 1) / 2;

        this.selected = 0; this.cards = [];

        weapons.forEach((wpn, i) => {
            const cx = startX + i * spacing, cy = H / 2 + 20;
            const card = this.add.container(cx, cy);
            const bg   = this.add.rectangle(0, 0, cardW, cardH, 0x0e0e1e).setStrokeStyle(1, 0x1e1e38);
            const icon = this._weaponIcon(wpn, 0, -52);
            const name = this.add.text(0, -10, wpn.name.toUpperCase(), {
                fontSize: '9px', color: '#d4d0c8', fontFamily: 'monospace', letterSpacing: 3,
            }).setOrigin(0.5);
            const desc = this.add.text(0, 24, wpn.desc, {
                fontSize: '7px', color: '#3a3a5a', fontFamily: 'monospace',
                align: 'center', wordWrap: { width: cardW - 18 },
            }).setOrigin(0.5, 0);
            const key  = this.add.text(0, 82, `[${i + 1}]`, {
                fontSize: '9px', color: '#222244', fontFamily: 'monospace',
            }).setOrigin(0.5);
            card.add([bg, icon, name, desc, key]);
            this.cards.push({ container: card, bg, wpn });
            bg.setInteractive({ useHandCursor: true });
            bg.on('pointerover', () => this._select(i));
            bg.on('pointerdown', () => this._start(weapons[this.selected].id));
        });

        this.add.text(W / 2, H - 24, 'CLICK OR PRESS 1–4    ENTER TO START', {
            fontSize: '6px', color: '#111128', fontFamily: 'monospace', letterSpacing: 2,
        }).setOrigin(0.5);
        this.add.text(W / 2, H - 38, 'ARROWS — MOVE / JUMP / SLIDE    X — DASH    Z — ATTACK    DOWN+Z (AIR) — SLAM (HAMMER)', {
            fontSize: '5px', color: '#111128', fontFamily: 'monospace', letterSpacing: 1,
        }).setOrigin(0.5);

        this.input.keyboard.on('keydown-ONE',   () => this._select(0));
        this.input.keyboard.on('keydown-TWO',   () => this._select(1));
        this.input.keyboard.on('keydown-THREE', () => this._select(2));
        this.input.keyboard.on('keydown-FOUR',  () => this._select(3));
        this.input.keyboard.on('keydown-ENTER', () => this._start(weapons[this.selected].id));
        this._select(0);
    }

    _weaponIcon(wpn, x, y) {
        const g = this.add.graphics(); g.x = x; g.y = y;
        if (wpn.id === 'sword') {
            g.lineStyle(3, wpn.swingCol, 1); g.lineBetween(-2, 18, 2, -18);
            g.lineStyle(2, wpn.swingCol, 0.5); g.lineBetween(-10, 2, 10, 2);
        } else if (wpn.id === 'hammer') {
            g.lineStyle(4, wpn.swingCol, 1); g.lineBetween(0, 18, 0, -6);
            g.fillStyle(wpn.swingCol, 1); g.fillRect(-10, -18, 20, 12);
        } else if (wpn.id === 'axe') {
            g.lineStyle(3, wpn.swingCol, 1); g.lineBetween(-2, 18, 2, -10);
            g.fillStyle(wpn.swingCol, 0.9); g.fillTriangle(2, -10, 14, -18, 14, 0);
        } else if (wpn.id === 'scythe') {
            // Handle
            g.lineStyle(3, 0x886622, 1); g.lineBetween(4, 20, -4, -8);
            // Blade - approximated with lines
            g.lineStyle(3, wpn.swingCol, 1);
            g.lineBetween(-4, -8, 8, -18);
            g.lineBetween(8, -18, 16, -10);
            g.lineBetween(16, -10, 10, 0);
            g.lineBetween(10, 0, 2, -4);
            // Inner blade edge
            g.lineStyle(1, wpn.glowCol, 0.6);
            g.lineBetween(8, -16, 14, -10);
        }
        return g;
    }

    _select(i) {
        if (i >= this.cards.length) return;
        this.selected = i;
        this.cards.forEach((c, idx) => {
            const active = idx === this.selected;
            c.bg.setStrokeStyle(active ? 2 : 1, active ? c.wpn.swingCol : 0x1e1e38);
            c.bg.setFillStyle(active ? 0x14142a : 0x0e0e1e);
        });
    }

    _start(weaponId) {
        this.cameras.main.fade(300, 0, 0, 0);
        this.time.delayedCall(310, () => this.scene.start('Game', { weaponId }));
    }
}
