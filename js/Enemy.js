class Enemy {
    constructor(scene, x, y, typeName) {
        this.scene    = scene;
        this.typeName = typeName;
        this.def      = Object.assign({}, C.ENEMY_TYPES[typeName]);

        if (!scene.textures.exists('enemy_' + typeName)) Enemy._makeTexture(scene, typeName, this.def);

        // Plain sprite — zero physics
        this.sprite = scene.add.sprite(x, y, 'enemy_' + typeName).setDepth(5);
        this.x = x;
        this.y = y;

        this.hp     = this.def.hp;
        this.maxHp  = this.def.hp;
        this.alive  = true;
        this.hitCd  = 0;

        // Ragdoll
        this.ragdoll      = false;
        this.ragdollTimer = 0;
        this.vx           = 0;
        this.vy           = 0;
        this.spin         = 0;
        this.slow         = 0;

        // Beat warn
        this.beatWarn  = false;
        this.beatWarnT = 0;

        // HP bar — plain rectangles, not physics
        const bw = this.def.w + 8;
        this.hpBg  = scene.add.rectangle(x, y - this.def.h / 2 - 8, bw, 3, 0x0a0000).setDepth(9);
        this.hpBar = scene.add.rectangle(x, y - this.def.h / 2 - 8, bw, 3, 0xcc1818).setDepth(10);
    }

    static _makeTexture(scene, name, def) {
        const g = scene.make.graphics({ add: false });
        const w = def.w, h = def.h, c = def.col;

        if (name === 'boss') {
            g.fillStyle(0x0a0000); g.fillRect(0, 0, w, h);
            g.fillStyle(c); g.fillRect(2, 2, w - 4, h - 4);
            g.fillStyle(0xff0000); g.fillRect(4, 5, 8, 6);
            g.fillStyle(0xff0000); g.fillRect(w - 12, 5, 8, 6);
            g.fillStyle(0xff4400); g.fillRect(6, 12, w - 12, 5);
            g.fillStyle(0x000000); g.fillRect(8, 13, 3, 3);
            g.fillStyle(0x000000); g.fillRect(w - 11, 13, 3, 3);
            // shoulder spikes
            g.fillStyle(0x550000); g.fillRect(0, 6, 4, 10);
            g.fillStyle(0x550000); g.fillRect(w - 4, 6, 4, 10);
        } else if (name === 'heavy') {
            g.fillStyle(0x1a0000); g.fillRect(0, 0, w, h);
            g.fillStyle(c); g.fillRect(2, 2, w - 4, h - 4);
            g.fillStyle(0xff3300); g.fillRect(3, 3, 5, 4);
            g.fillStyle(0xff3300); g.fillRect(w - 8, 3, 5, 4);
            g.fillStyle(0x330000); g.fillRect(4, 9, w - 8, h - 13);
        } else if (name === 'charger') {
            g.fillStyle(c); g.fillRect(2, 0, w - 4, h);
            g.fillStyle(0xff5500); g.fillRect(3, 2, 4, 3);
            g.fillStyle(0xff5500); g.fillRect(w - 7, 2, 4, 3);
            // arrow-tip shape
            g.fillStyle(0xff2200); g.fillRect(0, 0, 2, h / 2);
            g.fillStyle(0xff2200); g.fillRect(w - 2, 0, 2, h / 2);
        } else if (name === 'swarm') {
            g.fillStyle(c); g.fillRect(1, 2, w - 2, h - 4);
            g.fillStyle(c); g.fillRect(2, 0, w - 4, h);
            g.fillStyle(0xff4466); g.fillRect(2, 2, 3, 2);
            g.fillStyle(0xff4466); g.fillRect(w - 5, 2, 3, 2);
        } else {
            // grunt
            g.fillStyle(c); g.fillRect(2, 0, w - 4, h);
            g.fillStyle(0xff2200); g.fillRect(3, 3, 4, 4);
            g.fillStyle(0xff2200); g.fillRect(w - 7, 3, 4, 4);
            g.fillStyle(0x550000); g.fillRect(4, h / 2, w - 8, h / 2 - 2);
        }

        g.generateTexture('enemy_' + name, w, h);
        g.destroy();
    }

    update(delta, playerX, playerY) {
        if (!this.alive) return;
        const dt = delta * 0.001;

        if (this.hitCd    > 0) this.hitCd    -= delta;
        if (this.slow     > 0) this.slow     -= delta;
        if (this.beatWarnT > 0) { this.beatWarnT -= delta; if (this.beatWarnT <= 0) this.beatWarn = false; }

        const groundY = C.GROUND_Y - this.def.h / 2;

        if (this.ragdoll) {
            // Physics: gravity + drag + bounce
            this.ragdollTimer -= delta;
            this.vy += 1100 * dt;
            this.vx *= Math.pow(0.015, dt);  // strong horizontal drag
            this.x  += this.vx * dt;
            this.y  += this.vy * dt;
            this.sprite.angle += this.spin * dt;
            this.spin *= Math.pow(0.01, dt);

            // Ground bounce
            if (this.y >= groundY) {
                this.y   = groundY;
                this.vy *= -0.18;
                this.vx *= 0.55;
                if (Math.abs(this.vy) < 30) this.vy = 0;
            }

            // World clamp
            this.x = Phaser.Math.Clamp(this.x, 30, C.WORLD_W - 30);

            // Settle
            if (this.ragdollTimer <= 0 && Math.abs(this.vx) < 12 && this.vy === 0) {
                this.ragdoll = false;
                this.sprite.angle = 0;
            }
        } else {
            // Walk toward player
            const dx   = playerX - this.x;
            const dy   = playerY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 28) {
                const speedMul = this.slow > 0 ? 0.3 : 1;
                this.x += (dx / dist) * this.def.spd * speedMul * dt;
                this.y += (dy / dist) * this.def.spd * speedMul * dt;
            }
            // Clamp to ground — enemies stay on ground level unless launched
            this.y = Math.min(this.y, groundY);
        }

        // Sync sprite
        this.sprite.setPosition(this.x, this.y);
        this.sprite.setFlipX(this.x > playerX);

        // HP bar
        const by  = this.y - this.def.h / 2 - 8;
        const bw  = this.def.w + 8;
        this.hpBg.setPosition(this.x, by);
        const fw = Math.max(0, (this.hp / this.maxHp) * bw);
        this.hpBar.setPosition(this.x - (bw - fw) / 2, by).setSize(fw, 3);

        // Tint
        if      (this.beatWarn)    this.sprite.setTint(0xff8800);
        else if (this.hitCd > 120) this.sprite.setTint(0xffffff);
        else if (this.slow > 0)    this.sprite.setTint(0x4444ff);
        else                       this.sprite.clearTint();
    }

    takeDamage(dmg, kx, ky, slow = false) {
        if (!this.alive || this.hitCd > 0) return false;
        this.hp   -= dmg;
        this.hitCd = 130;
        this.vx    = kx;
        this.vy    = ky;
        this.ragdoll      = true;
        this.ragdollTimer = 600;
        this.spin  = (Math.random() - 0.5) * 700;
        if (slow) this.slow = 1800;
        if (this.hp <= 0) this.die();
        return true;
    }

    setBeatWarn(ms = 550) {
        this.beatWarn  = true;
        this.beatWarnT = ms;
    }

    die() {
        if (!this.alive) return;
        this.alive = false;
        this.sprite.destroy();
        this.hpBg.destroy();
        this.hpBar.destroy();
        this.scene.events.emit('enemyKilled', this);
    }

    distanceTo(px, py) {
        const dx = px - this.x, dy = py - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    get active() { return this.alive; }
}