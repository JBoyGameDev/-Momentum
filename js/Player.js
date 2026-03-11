class Player {
    constructor(scene, weaponId) {
        this.scene     = scene;
        this.weaponDef = C.WEAPONS[weaponId] || C.WEAPONS.sword;

        // Locked position — never changes
        this.x = C.PLAYER_X;
        this.y = C.PLAYER_Y;

        if (!scene.textures.exists('player')) Player._makeTexture(scene);

        // Plain sprite — NO physics body
        this.sprite = scene.add.sprite(this.x, this.y, 'player').setDepth(8);
        this.gfx    = scene.add.graphics().setDepth(9);

        this.hp      = C.PLAYER_HP;
        this.facing  = 1;
        this.dead    = false;
        this.hitFlashCd = 0;

        // Cooldowns per attack key
        this.cds = {};
        Object.keys(C.ATTACKS).forEach(k => this.cds[k] = 0);

        // Parry window
        this.parrying   = false;
        this.parryTimer = 0;

        // Meteor animation
        this.meteorActive = false;
        this.meteorTimer  = 0;

        // Swing visual
        this.swingKey   = null;
        this.swingTimer = 0;
    }

    static _makeTexture(scene) {
        const g = scene.make.graphics({ add: false });
        // White armor - Ultrakill V1 style
        g.fillStyle(0xffffff); g.fillRect(3, 6, 8, 10);
        g.fillStyle(0xdddddd); g.fillRect(4, 7, 6, 6);
        // Head
        g.fillStyle(0xeeeeee); g.fillRect(3, 0, 8, 7);
        // Cyan visor
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

        // Tick all cooldowns
        Object.keys(this.cds).forEach(k => { if (this.cds[k] > 0) this.cds[k] -= delta; });
        if (this.parryTimer  > 0) { this.parryTimer  -= delta; if (this.parryTimer  <= 0) this.parrying    = false; }
        if (this.meteorTimer > 0) { this.meteorTimer -= delta; if (this.meteorTimer <= 0) this.meteorActive = false; }
        if (this.hitFlashCd  > 0) this.hitFlashCd -= delta;
        if (this.swingTimer  > 0) { this.swingTimer  -= delta; if (this.swingTimer  <= 0) this.swingKey    = null;  }

        this._drawGfx();
        this._checkEnemyContact(enemies, effects);
    }

    tryAttack(key, enemies, effects, beatEngine) {
        if (this.dead || this.meteorActive) return false;
        const atk = C.ATTACKS[key];
        if (!atk || this.cds[key] > 0) return false;

        // Beat Blast fails if off-beat
        if (atk.beatOnly && !beatEngine.isOnBeat()) {
            this.scene.events.emit('beatMiss');
            return false;
        }

        // Parry: open counter window
        if (atk.parry) {
            this.parrying   = true;
            this.parryTimer = 300;
            this.cds[key]   = Math.round(atk.cd * this.weaponDef.cdMul);
            effects.parryFlash(this.x, this.y);
            return true;
        }

        // Meteor: delayed slam
        if (key === 'meteor') {
            this.cds[key] = atk.cd;
            this._doMeteor(enemies, effects, beatEngine);
            return true;
        }

        // All other attacks
        const onBeat = beatEngine.isOnBeat();
        const wpn    = this.weaponDef;
        this.cds[key]   = Math.round(atk.cd * wpn.cdMul);
        this.swingKey   = key;
        this.swingTimer = 200;

        enemies.forEach(e => {
            if (!e.active) return;
            const dist = e.distanceTo(this.x, this.y);
            if (dist > Math.round(atk.range * wpn.rangeMul)) return;

            // Directional filter for left/right slashes
            if (atk.dir === 'R' && e.x < this.x - 20) return;
            if (atk.dir === 'L' && e.x > this.x + 20) return;

            const dmgRaw = Phaser.Math.Between(atk.dmg[0], atk.dmg[1]);
            const dmg    = Math.round(dmgRaw * wpn.dmgMul * (onBeat ? C.ON_BEAT_MUL : 1));
            const dirX   = e.x >= this.x ? 1 : -1;
            const kx     = atk.kx * dirX;
            const ky     = key === 'up' ? -Math.abs(atk.ky) * 2.2
                         : key === 'down' ? Math.abs(atk.ky)
                         : atk.ky;

            const hit = e.takeDamage(dmg, kx, ky, !!(atk.slow));
            if (hit) {
                effects.blood(e.x, e.y, dmg);
                effects.impactLines(e.x, e.y, dmg, wpn.glow);
                effects.shockwave(e.x, e.y, dmg, 0xffffff, wpn.col);
                effects.damageNumber(e.x, e.y, dmg, onBeat);
                if (onBeat) effects.onBeatHitFlare();
                this.scene.events.emit('playerAttacked', { dmg, onBeat, key, enemyKilled: !e.alive });
            }
        });

        // AoE visuals for special moves
        if (key === 'vortex')    effects.vortexEffect(this.x, this.y, Math.round(atk.range * wpn.rangeMul));
        if (key === 'beatBlast') effects.beatBlastEffect(this.x, this.y, Math.round(atk.range * wpn.rangeMul));
        if (key === 'down')      { effects.dustCloud(this.x, this.y, 85, 5); effects.groundCrack(this.x, this.y); }
        if (key === 'shockwave') { effects.bigShockwave(this.x, this.y, Math.round(atk.range * wpn.rangeMul), 0x8888ff); effects.dustCloud(this.x, this.y, 90, 4); }
        if (key === 'dashSlash') this._doDashSlash(enemies, effects, onBeat);

        return true;
    }

    _doDashSlash(enemies, effects, onBeat) {
        // Flash afterimage toward nearest enemy
        let nearest = null, nearDist = Infinity;
        enemies.forEach(e => {
            if (!e.active) return;
            const d = e.distanceTo(this.x, this.y);
            if (d < nearDist && d < 240) { nearDist = d; nearest = e; }
        });
        if (!nearest) return;
        const img = this.scene.add.sprite(this.x, this.y, 'player').setDepth(7).setTint(0xffffff).setAlpha(0.7);
        this.scene.tweens.add({ targets: img, x: nearest.x, y: nearest.y, alpha: 0, duration: 160, onComplete: () => img.destroy() });
    }

    _doMeteor(enemies, effects, beatEngine) {
        this.meteorActive = true;
        const shadow = effects.meteorShadow(this.x, this.y);
        this.scene.tweens.add({ targets: this.sprite, y: this.y - 130, alpha: 0.3, duration: 480, ease: 'Power2' });
        this.scene.cameras.main.zoomTo(0.72, 380);

        this.scene.time.delayedCall(620, () => {
            this.sprite.y = this.y - 130;
            this.scene.tweens.add({ targets: this.sprite, y: this.y, alpha: 1, duration: 110, ease: 'Power4' });
            this.scene.cameras.main.zoomTo(1.0, 180);
            shadow.destroy();
            effects.meteorSlam(this.x, this.y);
            this.meteorActive = false;

            const atk    = C.ATTACKS.meteor;
            const onBeat = beatEngine.isOnBeat();
            const range  = Math.round(atk.range * this.weaponDef.rangeMul);
            enemies.forEach(e => {
                if (!e.active) return;
                const dist = e.distanceTo(this.x, this.y);
                if (dist > range) return;
                const falloff = 1 - dist / range;
                const dmg = Math.round(Phaser.Math.Between(atk.dmg[0], atk.dmg[1]) * this.weaponDef.dmgMul * falloff * (onBeat ? C.ON_BEAT_MUL : 1));
                e.takeDamage(dmg, (e.x > this.x ? 1 : -1) * atk.kx * falloff, atk.ky * falloff);
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
        if (enemy.distanceTo(this.x, this.y) > 85) return false;
        const atk = C.ATTACKS.parry;
        const dmg = Math.round(Phaser.Math.Between(atk.dmg[0], atk.dmg[1]) * this.weaponDef.dmgMul);
        const dir = enemy.x >= this.x ? 1 : -1;
        enemy.takeDamage(dmg, atk.kx * dir, atk.ky);
        effects.blood(enemy.x, enemy.y, dmg, true);
        effects.bigShockwave(this.x, this.y, 90, 0xffffff);
        effects.damageNumber(enemy.x, enemy.y, dmg, true);
        this.scene.cameras.main.shake(280, 0.025);
        this.scene.events.emit('hitStop', 220);
        this.scene.events.emit('playerAttacked', { dmg, onBeat: true, key: 'parry', enemyKilled: !enemy.alive });
        this.parrying = false;
        return true;
    }

    takeDamage(dmg) {
        if (this.parrying) return;
        if (this.hitFlashCd > 0) return;
        this.hp -= dmg;
        this.hitFlashCd = 500;
        this.sprite.setTint(0xff2200);
        this.scene.time.delayedCall(120, () => { if (!this.dead) this.sprite.clearTint(); });
        this.scene.cameras.main.flash(70, 255, 0, 0, false);
        this.scene.cameras.main.shake(120, 0.013);
        this.scene.events.emit('playerDamaged', dmg);
        if (this.hp <= 0) { this.hp = 0; this.dead = true; this.scene.events.emit('playerDied'); }
    }

    heal(amount) { this.hp = Math.min(C.PLAYER_HP, this.hp + amount); }

    _drawGfx() {
        this.gfx.clear();
        this.sprite.setFlipX(this.facing === -1);

        // Parry ring
        if (this.parrying) {
            const a = 0.5 + Math.sin(Date.now() * 0.025) * 0.3;
            this.gfx.lineStyle(3, 0xffffff, a);
            this.gfx.strokeCircle(this.x, this.y, 52);
        }

        // Swing arc
        if (this.swingKey && this.swingTimer > 0) {
            const atk  = C.ATTACKS[this.swingKey];
            const wpn  = this.weaponDef;
            const prog = 1 - this.swingTimer / 200;
            const r    = Math.round(atk.range * wpn.rangeMul);
            const col  = wpn.col;
            const sw   = 2 + prog * 4;

            if (atk.dir === 'R') {
                this.gfx.lineStyle(sw, col, 0.9);
                this.gfx.beginPath(); this.gfx.arc(this.x, this.y, r, -1.3, Phaser.Math.Linear(-1.3, 1.3, prog)); this.gfx.strokePath();
            } else if (atk.dir === 'L') {
                this.gfx.lineStyle(sw, col, 0.9);
                this.gfx.beginPath(); this.gfx.arc(this.x, this.y, r, Math.PI + 1.3, Phaser.Math.Linear(Math.PI + 1.3, Math.PI - 1.3, prog), true); this.gfx.strokePath();
            } else {
                this.gfx.lineStyle(sw, col, 0.75);
                this.gfx.beginPath(); this.gfx.arc(this.x, this.y, r, 0, Phaser.Math.Linear(0, Math.PI * 2, prog)); this.gfx.strokePath();
            }
        }
    }

    _checkEnemyContact(enemies, effects) {
        enemies.forEach(e => {
            if (!e.active || e.ragdoll) return;
            if (e.distanceTo(this.x, this.y) < 28) {
                if (!this.tryParryCounter(e, effects)) this.takeDamage(e.def.dmg);
            }
        });
    }
}