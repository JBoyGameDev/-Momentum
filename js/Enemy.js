class Enemy {
    constructor(scene, x, y, typeName) {
        this.scene    = scene;
        this.typeName = typeName;
        this.def      = C.ENEMY_TYPES[typeName];

        if (!scene.textures.exists('enemy_' + typeName)) Enemy._makeTexture(scene, typeName, this.def);

        this.sprite = scene.add.sprite(x, y, 'enemy_' + typeName).setDepth(5);
        this.x      = x;
        this.y      = y;

        this.hp     = this.def.hp;
        this.maxHp  = this.def.hp;
        this.alive  = true;
        this.hitCd  = 0;
        this.slow   = 0;    // slow timer ms

        // Ragdoll physics
        this.vx     = 0;
        this.vy     = 0;
        this.ragdoll = false;
        this.ragdollTimer = 0;
        this.spin   = 0;

        // Beat attack indicator
        this.beatWarn  = false;
        this.beatWarnT = 0;

        // HP bar
        const barW = this.def.w + 8;
        this.hpBg  = scene.add.rectangle(x, y - this.def.h / 2 - 8, barW, 3, 0x0a0000).setDepth(9);
        this.hpBar = scene.add.rectangle(x, y - this.def.h / 2 - 8, barW, 3, 0xcc1818).setDepth(10);
    }

    static _makeTexture(scene, name, def) {
        const g = scene.make.graphics({ add: false });
        const w = def.w, h = def.h;
        const c = def.col;

        if (name === 'boss') {
            // Boss: huge dark demon
            g.fillStyle(0x0a0000); g.fillRect(0, 0, w, h);
            g.fillStyle(c); g.fillRect(2, 2, w - 4, h - 4);
            g.fillStyle(0xff0000); g.fillRect(4, 4, 8, 6);   // left eye
            g.fillStyle(0xff0000); g.fillRect(w - 12, 4, 8, 6); // right eye
            g.fillStyle(0xff2200); g.fillRect(5, 11, w - 10, 4); // mouth
            g.fillStyle(0x000000); g.fillRect(7, 12, 3, 3);
            g.fillStyle(0x000000); g.fillRect(w - 10, 12, 3, 3);
        } else if (name === 'heavy') {
            // Heavy: wide, armored
            g.fillStyle(0x1a0000); g.fillRect(0, 0, w, h);
            g.fillStyle(c); g.fillRect(2, 2, w - 4, h - 4);
            g.fillStyle(0xff3300); g.fillRect(3, 3, 5, 4);
            g.fillStyle(0xff3300); g.fillRect(w - 8, 3, 5, 4);
            g.fillStyle(0x330000); g.fillRect(4, 8, w - 8, h - 12);
        } else if (name === 'charger') {
            // Charger: lean, arrow-shaped
            g.fillStyle(c); g.fillRect(2, 0, w - 4, h);
            g.fillStyle(0xff5500); g.fillRect(3, 2, 4, 3);
            g.fillStyle(0xff5500); g.fillRect(w - 7, 2, 4, 3);
            g.fillStyle(0xff2200); g.fillRect(1, 0, 2, h / 2);
            g.fillStyle(0xff2200); g.fillRect(w - 3, 0, 2, h / 2);
        } else if (name === 'swarm') {
            // Swarm: tiny, round-ish
            g.fillStyle(c); g.fillRect(0, 2, w, h - 4);
            g.fillStyle(c); g.fillRect(2, 0, w - 4, h);
            g.fillStyle(0xff4466); g.fillRect(1, 1, 3, 3);
            g.fillStyle(0xff4466); g.fillRect(w - 4, 1, 3, 3);
        } else {
            // Grunt: standard
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

        if (this.hitCd  > 0) this.hitCd  -= delta;
        if (this.slow   > 0) this.slow   -= delta;
        if (this.beatWarnT > 0) {
            this.beatWarnT -= delta;
            if (this.beatWarnT <= 0) this.beatWarn = false;
        }

        if (this.ragdoll) {
            this.ragdollTimer -= delta;
            this.vx *= (1 - 3.5 * dt);
            this.vy += 920 * dt;
            this.x  += this.vx * dt;
            this.y  += this.vy * dt;
            this.sprite.angle += this.spin * dt;

            // Ground bounce
            if (this.y > C.GROUND_Y - this.def.h / 2) {
                this.y  = C.GROUND_Y - this.def.h / 2;
                this.vy *= -0.22;
                this.vx *= 0.6;
                this.spin *= 0.5;
            }

            if (this.ragdollTimer <= 0 && Math.abs(this.vx) < 20 && Math.abs(this.vy) < 20) {
                this.ragdoll = false;
                this.vx = 0; this.vy = 0;
            }
        } else {
            // Approach player
            const dx   = playerX - this.x;
            const dy   = playerY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 2) {
                const speedMul = this.slow > 0 ? 0.35 : 1;
                const spd = this.def.spd * speedMul;
                this.x += (dx / dist) * spd * dt;
                this.y += (dy / dist) * spd * dt;
            }

            // Keep on ground (gravity)
            if (this.y < C.GROUND_Y - this.def.h / 2)
                this.y += 600 * dt;
            this.y = Math.min(this.y, C.GROUND_Y - this.def.h / 2);
        }

        // Update sprite + HP bar
        this.sprite.setPosition(this.x, this.y);
        this.sprite.setFlipX(this.x > playerX);

        const by   = this.y - this.def.h / 2 - 8;
        const barW = this.def.w + 8;
        this.hpBg.setPosition(this.x, by);
        const fw = Math.max(0, (this.hp / this.maxHp) * barW);
        this.hpBar.setPosition(this.x - (barW - fw) / 2, by).setSize(fw, 3);

        // Beat warn tint
        if (this.beatWarn) this.sprite.setTint(0xffaa00);
        else if (this.hitCd > 0) this.sprite.setTint(0xffffff);
        else if (this.slow > 0) this.sprite.setTint(0x4444ff);
        else this.sprite.clearTint();
    }

    takeDamage(dmg, kx, ky, slow = false) {
        if (!this.alive || this.hitCd > 0) return false;
        this.hp   -= dmg;
        this.hitCd = 140;
        this.vx    = kx;
        this.vy    = ky;
        this.ragdoll      = true;
        this.ragdollTimer = 500;
        this.spin  = (Math.random() - 0.5) * 600;
        if (slow) this.slow = 1800;
        if (this.hp <= 0) this.die();
        return true;
    }

    setBeatWarn(ms = 600) {
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

    get active() { return this.alive; }

    distanceTo(px, py) {
        const dx = px - this.x, dy = py - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
