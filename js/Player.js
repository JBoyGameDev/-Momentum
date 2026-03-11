class Player {
    constructor(scene, weaponId) {
        this.scene     = scene;
        this.weaponDef = C.WEAPONS[weaponId] || C.WEAPONS.sword;
        this.x         = C.PLAYER_X;
        this.y         = C.PLAYER_Y;

        if (!scene.textures.exists('player')) Player._makeTexture(scene);
        this.sprite = scene.add.sprite(this.x, this.y, 'player').setDepth(8);

        this.gfx    = scene.add.graphics().setDepth(9);

        this.hp     = C.PLAYER_HP;
        this.facing = 1;   // 1 = right, -1 = left
        this.dead   = false;

        // Cooldowns per attack key
        this.cds    = {};
        Object.keys(C.ATTACKS).forEach(k => this.cds[k] = 0);

        // Parry state
        this.parrying    = false;
        this.parryTimer  = 0;

        // Meteor animation
        this.meteorActive = false;
        this.meteorTimer  = 0;

        // Visual
        this.swingGfx    = null;
        this.swingTimer  = 0;
        this.swingKey    = null;
        this.hitFlashCd  = 0;

        // Camera lean
        this.leanX = 0;
        this.leanY = 0;
    }

    static _makeTexture(scene) {
        const g = scene.make.graphics({ add: false });
        // Body - white armor (Ultrakill V1 style)
        g.fillStyle(0xffffff); g.fillRect(3, 6, 8, 10);
        // Chest plate
        g.fillStyle(0xdddddd); g.fillRect(4, 7, 6, 6);
        // Head
        g.fillStyle(0xeeeeee); g.fillRect(3, 0, 8, 7);
        // Visor - cyan
        g.fillStyle(0x00ffee); g.fillRect(4, 1, 6, 3);
        g.fillStyle(0x003333); g.fillRect(4, 1, 6, 3);
        g.fillStyle(0x00ffee); g.fillRect(5, 2, 4, 1);
        // Arms
        g.fillStyle(0xcccccc); g.fillRect(0, 7, 3, 7);
        g.fillStyle(0xcccccc); g.fillRect(11, 7, 3, 7);
        // Fists
        g.fillStyle(0xaaaaaa); g.fillRect(0, 13, 3, 3);
        g.fillStyle(0xaaaaaa); g.fillRect(11, 13, 3, 3);
        // Legs
        g.fillStyle(0xaaaaaa); g.fillRect(3, 16, 4, 6);
        g.fillStyle(0xaaaaaa); g.fillRect(7, 16, 4, 6);
        // Boots
        g.fillStyle(0x333333); g.fillRect(2, 19, 5, 3);
        g.fillStyle(0x333333); g.fillRect(7, 19, 5, 3);
        g.generateTexture('player', 14, 22);
        g.destroy();
    }

    update(delta, enemies, effects, beatEngine) {
        if (this.dead) return;

        // Timers
        Object.keys(this.cds).forEach(k => { if (this.cds[k] > 0) this.cds[k] -= delta; });
        if (this.parryTimer  > 0) { this.parryTimer  -= delta; if (this.parryTimer  <= 0) this.parrying    = false; }
        if (this.meteorTimer > 0) { this.meteorTimer -= delta; if (this.meteorTimer <= 0) this.meteorActive = false; }
        if (this.hitFlashCd  > 0) this.hitFlashCd -= delta;
        if (this.swingTimer  > 0) { this.swingTimer -= delta; if (this.swingTimer <= 0) this.swingKey = null; }

        this._drawSelf(effects);
        this._checkEnemyContact(enemies, effects);
    }

    tryAttack(key, enemies, effects, beatEngine) {
        if (this.dead || this.meteorActive) return false;
        const atk = C.ATTACKS[key];
        if (!atk) return false;
        if (this.cds[key] > 0) return false;

        // Beat Blast: reject if not on beat
        if (atk.beatOnly && !beatEngine.isOnBeat()) {
            this.scene.events.emit('beatMiss');
            return false;
        }

        // Parry: set state instead of hitting
        if (atk.parry) {
            this.parrying   = true;
            this.parryTimer = 300;
            this.cds[key]   = Math.round(atk.cd * this.weaponDef.cdMul);
            effects.parryFlash(this.x, this.y);
            return true;
        }

        // Meteor: visual delay then slam
        if (key === 'meteor') {
            this._doMeteor(enemies, effects, beatEngine);
            this.cds[key] = atk.cd;
            return true;
        }

        const onBeat  = beatEngine.isOnBeat();
        const wpn     = this.weaponDef;
        const cd      = Math.round(atk.cd * wpn.cdMul);
        const range   = Math.round(atk.range * wpn.rangeMul);

        this.cds[key]   = cd;
        this.swingKey   = key;
        this.swingTimer = 220;

        let hitAny = false;
        enemies.forEach(e => {
            if (!e.active) return;
            const dist = e.distanceTo(this.x, this.y);
            if (dist > range) return;

            // Direction filter
            if (atk.dir === 'R' && e.x < this.x) return;
            if (atk.dir === 'L' && e.x > this.x) return;

            const dmgRaw  = Phaser.Math.Between(atk.dmg[0], atk.dmg[1]);
            const dmgWpn  = Math.round(dmgRaw * wpn.dmgMul);
            const dmg     = onBeat ? Math.round(dmgWpn * C.ON_BEAT_MUL) : dmgWpn;
            const dirX    = e.x > this.x ? 1 : -1;
            const kx      = atk.kx * dirX;
            const ky      = key === 'up' ? atk.ky : (key === 'down' ? Math.abs(atk.ky) : atk.ky);
            const slow    = !!(atk.slow);

            const hit = e.takeDamage(dmg, kx, ky, slow);
            if (hit) {
                hitAny = true;
                effects.blood(e.x, e.y, dmg);
                effects.impactLines(e.x, e.y, dmg, wpn.glow);
                effects.shockwave(e.x, e.y, dmg, 0xffffff, wpn.col);
                effects.damageNumber(e.x, e.y, dmg, onBeat);
                if (onBeat) effects.onBeatHitFlare();
                this.scene.events.emit('playerAttacked', { dmg, onBeat, key, enemyKilled: !e.alive });
                if (key === 'down') effects.dustCloud(e.x, e.y);
            }
        });

        // Special AoE visuals
        if (key === 'vortex') effects.vortexEffect(this.x, this.y, range);
        if (key === 'beatBlast') effects.beatBlastEffect(this.x, this.y, range);
        if (key === 'down') { effects.dustCloud(this.x, this.y, 80, 5); effects.groundCrack(this.x, this.y); }
        if (key === 'dashSlash') this._doDashSlash(enemies, effects, onBeat, beatEngine);
        if (key === 'shockwave') { effects.bigShockwave(this.x, this.y, range, 0x8888ff); effects.dustCloud(this.x, this.y, 90, 4); }

        return hitAny;
    }

    _doDashSlash(enemies, effects, onBeat, beatEngine) {
        // Find nearest enemy and teleport to it
        let nearest = null, nearDist = Infinity;
        enemies.forEach(e => {
            if (!e.active) return;
            const d = e.distanceTo(this.x, this.y);
            if (d < nearDist) { nearDist = d; nearest = e; }
        });
        if (!nearest || nearDist > 210) return;

        // Flash trail
        const afterImg = this.scene.add.sprite(this.x, this.y, 'player').setDepth(7).setTint(0xffffff).setAlpha(0.6);
        this.scene.tweens.add({ targets: afterImg, alpha: 0, x: nearest.x, y: nearest.y, duration: 180, onComplete: () => afterImg.destroy() });
    }

    _doMeteor(enemies, effects, beatEngine) {
        this.meteorActive = true;
        this.meteorTimer  = 800;

        // Shadow on ground
        const shadow = effects.meteorShadow(this.x, this.y);

        // Player sprite zoom up and disappear
        this.scene.tweens.add({ targets: this.sprite, y: this.y - 140, alpha: 0.3, duration: 500, ease: 'Power2' });
        this.scene.cameras.main.zoomTo(0.7, 400);

        this.scene.time.delayedCall(650, () => {
            // Slam back down
            this.sprite.y = this.y - 140;
            this.scene.tweens.add({ targets: this.sprite, y: this.y, alpha: 1, duration: 120, ease: 'Power3' });
            this.scene.cameras.main.zoomTo(1.0, 200);
            shadow.destroy();

            const atk    = C.ATTACKS.meteor;
            const range  = Math.round(atk.range * this.weaponDef.rangeMul);
            const onBeat = beatEngine.isOnBeat();
            effects.meteorSlam(this.x, C.GROUND_Y);
            this.meteorActive = false;

            enemies.forEach(e => {
                if (!e.active) return;
                const dist = e.distanceTo(this.x, this.y);
                if (dist > range) return;
                const falloff = 1 - dist / range;
                const dmgRaw  = Phaser.Math.Between(atk.dmg[0], atk.dmg[1]);
                const dmg     = Math.round(dmgRaw * this.weaponDef.dmgMul * falloff * (onBeat ? C.ON_BEAT_MUL : 1));
                const kx      = (e.x > this.x ? 1 : -1) * atk.kx * falloff;
                e.takeDamage(dmg, kx, atk.ky * falloff);
                if (dmg > 0) {
                    effects.blood(e.x, e.y, dmg, true);
                    effects.damageNumber(e.x, e.y, dmg, onBeat);
                    this.scene.events.emit('playerAttacked', { dmg, onBeat, key: 'meteor', enemyKilled: !e.alive });
                }
            });
        });
    }

    tryParryCounter(enemy, effects) {
        if (!this.parrying) return false;
        const dist = Math.sqrt((enemy.x - this.x) ** 2 + (enemy.y - this.y) ** 2);
        if (dist > 80) return false;

        const atk = C.ATTACKS.parry;
        const dmg = Math.round(Phaser.Math.Between(atk.dmg[0], atk.dmg[1]) * this.weaponDef.dmgMul);
        const dir = enemy.x > this.x ? 1 : -1;
        enemy.takeDamage(dmg, atk.kx * dir, atk.ky);
        effects.blood(enemy.x, enemy.y, dmg, true);
        effects.impactLines(enemy.x, enemy.y, dmg, 0xffffff);
        effects.bigShockwave(this.x, this.y, 80, 0xffffff);
        effects.damageNumber(enemy.x, enemy.y, dmg, true);
        this.scene.cameras.main.shake(280, 0.025);
        // Freeze frame
        this.scene.time.delayedCall(20, () => this.scene.events.emit('hitStop', 250));
        this.scene.events.emit('playerAttacked', { dmg, onBeat: true, key: 'parry', enemyKilled: !enemy.alive });
        this.parrying = false;
        return true;
    }

    takeDamage(dmg) {
        if (this.parrying) return; // parry absorbs hit
        if (this.hitFlashCd > 0) return;
        this.hp -= dmg;
        this.hitFlashCd = 500;
        this.sprite.setTint(0xff0000);
        this.scene.time.delayedCall(120, () => this.sprite.clearTint());
        this.scene.cameras.main.flash(80, 255, 0, 0, false);
        this.scene.cameras.main.shake(130, 0.013);
        this.scene.events.emit('playerDamaged', dmg);
        if (this.hp <= 0) {
            this.hp   = 0;
            this.dead = true;
            this.scene.events.emit('playerDied');
        }
    }

    heal(amount) {
        this.hp = Math.min(C.PLAYER_HP, this.hp + amount);
    }

    setLean(dx, dy) {
        this.leanX = dx;
        this.leanY = dy;
    }

    _drawSelf(effects) {
        this.gfx.clear();

        // Parry glow ring
        if (this.parrying) {
            const alpha = 0.5 + Math.sin(Date.now() * 0.02) * 0.3;
            this.gfx.lineStyle(3, 0xffffff, alpha);
            this.gfx.strokeCircle(this.x, this.y, 50);
        }

        // Swing arc visual
        if (this.swingKey && this.swingTimer > 0) {
            const atk  = C.ATTACKS[this.swingKey];
            const wpn  = this.weaponDef;
            const prog = 1 - this.swingTimer / 220;
            const col  = wpn.col;
            const r    = Math.round(atk.range * wpn.rangeMul);

            if (atk.dir === 'R') {
                const ang = Phaser.Math.Linear(-1.4, 1.4, prog);
                this.gfx.lineStyle(3 + prog * 3, col, 0.85);
                this.gfx.beginPath(); this.gfx.arc(this.x, this.y, r, -1.4, ang); this.gfx.strokePath();
            } else if (atk.dir === 'L') {
                const ang = Phaser.Math.Linear(Math.PI + 1.4, Math.PI - 1.4, prog);
                this.gfx.lineStyle(3 + prog * 3, col, 0.85);
                this.gfx.beginPath(); this.gfx.arc(this.x, this.y, r, Math.PI + 1.4, ang, true); this.gfx.strokePath();
            } else {
                // 360 arc for ALL direction attacks
                const ang = Phaser.Math.Linear(0, Math.PI * 2, prog);
                this.gfx.lineStyle(2 + prog * 4, col, 0.7);
                this.gfx.beginPath(); this.gfx.arc(this.x, this.y, r, 0, ang); this.gfx.strokePath();
            }
        }

        this.sprite.setFlipX(this.facing === -1);
    }

    _checkEnemyContact(enemies, effects) {
        enemies.forEach(e => {
            if (!e.active || e.ragdoll) return;
            const dist = e.distanceTo(this.x, this.y);
            if (dist < 30) {
                // Try parry counter first
                if (!this.tryParryCounter(e, effects)) {
                    this.takeDamage(e.def.dmg);
                }
            }
        });
    }
}
