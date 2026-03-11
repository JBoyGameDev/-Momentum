class Effects {
    constructor(scene) {
        this.scene     = scene;
        this.particles = [];
    }

    update(delta) {
        if (this.particles.length > 400) {
            const excess = this.particles.splice(0, this.particles.length - 400);
            excess.forEach(p => p.r.destroy());
        }
        const dt = delta * 0.001;
        this.particles = this.particles.filter(p => {
            p.life -= delta;
            if (p.life <= 0) { p.r.destroy(); return false; }
            if (p.phys) {
                p.vy += p.grav * dt;
                p.r.x += p.vx * dt;
                p.r.y += p.vy * dt;
                if (p.spin) p.r.angle += p.spin * dt;
            }
            p.r.setAlpha((p.life / p.max) * p.baseAlpha);
            return true;
        });
    }

    _addParticle(r, life, vx = 0, vy = 0, grav = 0, spin = 0, baseAlpha = 1) {
        this.particles.push({ r, life, max: life, phys: !!(vx || vy || grav), vx, vy, grav, spin, baseAlpha });
    }

    // ── Blood ──────────────────────────────────────────────────────

    blood(x, y, dmg, heavy = false) {
        const count = Math.min(50, heavy ? 40 + Math.floor(dmg * 1.2) : 10 + Math.floor(dmg * 0.7));
        for (let i = 0; i < count; i++) {
            const sz  = Phaser.Math.Between(heavy ? 3 : 2, heavy ? 10 : 6);
            const ang = Math.random() * Math.PI * 2;
            const spd = 60 + Math.random() * (heavy ? 500 : 280) + dmg * 4;
            const r   = this.scene.add.rectangle(
                x + Phaser.Math.Between(-8, 8), y + Phaser.Math.Between(-12, 4),
                sz, sz,
                Phaser.Math.RND.pick([0xff0000, 0xee0011, 0xcc0000, 0xff1122]),
                1
            ).setDepth(14);
            this._addParticle(r, 500 + Math.random() * 600, Math.cos(ang) * spd, Math.sin(ang) * spd - 80, 820, (Math.random() - 0.5) * 400);
        }
    }

    killBlood(x, y) {
        for (let i = 0; i < 80; i++) {
            const sz  = Phaser.Math.Between(3, 16);
            const ang = Math.random() * Math.PI * 2;
            const spd = 120 + Math.random() * 820;
            const r   = this.scene.add.rectangle(x, y, sz, sz,
                Phaser.Math.RND.pick([0xff0000, 0xff1100, 0xee0000, 0xcc0000, 0xff2200]), 1
            ).setDepth(14);
            this._addParticle(r, 800 + Math.random() * 800, Math.cos(ang) * spd, Math.sin(ang) * spd - 200, 900, (Math.random() - 0.5) * 600);
        }
    }

    // ── Dust cloud ────────────────────────────────────────────────

    dustCloud(x, y, size = 65, count = 4) {
        for (let i = 0; i < count; i++) {
            const dx  = x + Phaser.Math.Between(-25, 25);
            const dy  = y + Phaser.Math.Between(-12, 12);
            const r   = this.scene.add.circle(dx, dy, size * 0.25, 0x999999, 0).setDepth(12);
            r.setStrokeStyle(0);
            this.scene.tweens.add({
                targets: r,
                scaleX: size / (size * 0.25),
                scaleY: (size / (size * 0.25)) * 0.55,
                alpha: 0,
                duration: 380 + Math.random() * 220,
                ease: 'Power2',
                onComplete: () => r.destroy(),
            });
            // fill alpha pulse
            this.scene.tweens.add({ targets: r, fillAlpha: 0.45, duration: 60, yoyo: true });
        }
    }

    groundCrack(x, y) {
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            const len = 30 + Math.random() * 50;
            const ln  = this.scene.add.line(0, 0, x, y,
                x + Math.cos(ang) * len, y + Math.sin(ang) * len * 0.35,
                0xffffff, 0.7
            ).setDepth(13).setLineWidth(1 + Math.random() * 1.5);
            this.scene.tweens.add({ targets: ln, alpha: 0, duration: 500, onComplete: () => ln.destroy() });
        }
    }

    // ── Impact ────────────────────────────────────────────────────

    impactLines(x, y, dmg, col) {
        const count = Math.min(24, 10 + Math.floor(dmg / 3));
        for (let i = 0; i < count; i++) {
            const ang = (i / count) * Math.PI * 2 + Math.random() * 0.4;
            const len = 18 + dmg * 1.1 + Math.random() * 20;
            const c   = i % 3 === 0 ? 0xffffff : i % 3 === 1 ? (col || 0xff4400) : 0xffdd00;
            const ln  = this.scene.add.line(0, 0,
                x + Math.cos(ang) * 6, y + Math.sin(ang) * 6,
                x + Math.cos(ang) * len, y + Math.sin(ang) * len,
                c, 1
            ).setDepth(16).setLineWidth(dmg > 30 ? 2.5 : 1.5);
            this.scene.tweens.add({ targets: ln, alpha: 0, duration: 160 + dmg * 3, onComplete: () => ln.destroy() });
        }
    }

    shockwave(x, y, dmg, col1 = 0xffffff, col2 = 0xff2200) {
        const mk = (radius, strokeCol, sw, dur) => {
            const r = this.scene.add.circle(x, y, radius, 0, 0).setDepth(15).setStrokeStyle(sw, strokeCol, 1);
            const sc = (1 + dmg * 0.2) / (radius / 5);
            this.scene.tweens.add({ targets: r, scaleX: sc, scaleY: sc, alpha: 0, duration: dur, ease: 'Power2', onComplete: () => r.destroy() });
        };
        mk(5, col1, 2, 260 + dmg * 4);
        if (dmg > 12) mk(4, col2, 3, 360);
        if (dmg > 30) mk(3, 0xffff00, 4, 200);
    }

    bigShockwave(x, y, radius, col = 0xffffff) {
        for (let i = 0; i < 4; i++) {
            const delay = i * 55;
            this.scene.time.delayedCall(delay, () => {
                const r = this.scene.add.circle(x, y, 8, 0, 0).setDepth(15)
                    .setStrokeStyle(5 - i, col, 1 - i * 0.15);
                const sc = (radius / 8) * (1 + i * 0.35);
                this.scene.tweens.add({ targets: r, scaleX: sc, scaleY: sc, alpha: 0, duration: 420 + i * 70, onComplete: () => r.destroy() });
            });
        }
        for (let i = 0; i < 12; i++) {
            const ang = (i / 12) * Math.PI * 2;
            const len = radius * (0.7 + Math.random() * 0.5);
            const ln  = this.scene.add.line(0, 0, x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, col, 1)
                .setDepth(16).setLineWidth(2);
            this.scene.tweens.add({ targets: ln, alpha: 0, duration: 500, onComplete: () => ln.destroy() });
        }
    }

    damageNumber(x, y, dmg, onBeat = false) {
        const isBig = dmg >= 40 || onBeat;
        const col   = onBeat ? '#ffffff' : dmg >= 35 ? '#ff0000' : dmg >= 18 ? '#ff5500' : '#ffcc00';
        const fsz   = isBig ? (onBeat ? '22px' : '18px') : dmg >= 18 ? '12px' : '9px';
        const t = this.scene.add.text(x, y - 30, onBeat ? `✦${dmg}✦` : String(dmg), {
            fontSize: fsz, color: col, stroke: '#000', strokeThickness: isBig ? 6 : 3, fontFamily: 'monospace',
        }).setDepth(20).setOrigin(0.5);
        if (isBig) {
            t.setScale(0.3);
            this.scene.tweens.add({
                targets: t, scaleX: onBeat ? 2.2 : 1.8, scaleY: onBeat ? 2.2 : 1.8,
                y: t.y - 55, alpha: 0, duration: onBeat ? 1100 : 900, ease: 'Back.Out',
                onComplete: () => t.destroy(),
            });
        } else {
            this.scene.tweens.add({ targets: t, y: t.y - 32, alpha: 0, duration: 700, ease: 'Power2', onComplete: () => t.destroy() });
        }
    }

    // ── Special attack effects ─────────────────────────────────────

    meteorShadow(x, y) {
        // Growing shadow on ground before slam
        const shadow = this.scene.add.ellipse(x, C.GROUND_Y, 10, 5, 0x000000, 0.8).setDepth(3);
        this.scene.tweens.add({ targets: shadow, scaleX: 20, scaleY: 10, duration: 600, ease: 'Power2' });
        return shadow;
    }

    meteorSlam(x, y) {
        this.bigShockwave(x, y, 180, 0xffffff);
        this.dustCloud(x, y, 120, 8);
        this.groundCrack(x, y);
        this.scene.cameras.main.shake(300, 0.022);
        this.scene.cameras.main.flash(120, 255, 255, 255, false);
    }

    vortexEffect(x, y, radius) {
        for (let i = 0; i < 16; i++) {
            const ang = (i / 16) * Math.PI * 2;
            const spd = 300 + Math.random() * 200;
            const r = this.scene.add.rectangle(
                x + Math.cos(ang) * 20, y + Math.sin(ang) * 20,
                4, 4, Phaser.Math.RND.pick([0xffffff, 0xcccccc, 0xff2200]), 1
            ).setDepth(15);
            this._addParticle(r, 400, Math.cos(ang) * spd, Math.sin(ang) * spd - 100, 400, 500);
        }
        this.bigShockwave(x, y, radius, 0xaaaaff);
    }

    parryFlash(x, y) {
        const ring = this.scene.add.circle(x, y, 20, 0xffffff, 0).setDepth(18)
            .setStrokeStyle(5, 0xffffff, 1);
        this.scene.tweens.add({ targets: ring, scaleX: 6, scaleY: 6, alpha: 0, duration: 300, ease: 'Power3', onComplete: () => ring.destroy() });
        this.scene.cameras.main.flash(180, 255, 255, 255, false);
        this.scene.cameras.main.shake(220, 0.018);
    }

    beatBlastEffect(x, y, radius) {
        // Pure white explosion — very Ultrakill
        this.scene.cameras.main.flash(80, 255, 255, 255, false);
        this.scene.cameras.main.shake(250, 0.02);
        for (let i = 0; i < 5; i++) {
            const delay = i * 30;
            this.scene.time.delayedCall(delay, () => {
                const r = this.scene.add.circle(x, y, 6, 0xffffff, 0)
                    .setDepth(18).setStrokeStyle(6 - i, 0xffffff, 1);
                this.scene.tweens.add({ targets: r, scaleX: radius / 6, scaleY: radius / 6, alpha: 0, duration: 350 + i * 50, onComplete: () => r.destroy() });
            });
        }
        this.dustCloud(x, y, 100, 6);
    }

    onBeatHitFlare() {
        const cam = this.scene.cameras.main;
        cam.flash(40, 255, 255, 255, false);
    }
}
