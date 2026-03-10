class Effects {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
    }

    update(delta) {
        // Performance cap — destroy oldest particles first
        if (this.particles.length > 300) {
            const excess = this.particles.splice(0, this.particles.length - 300);
            excess.forEach(p => p.r.destroy());
        }

        const dt = delta * 0.001;
        this.particles = this.particles.filter(p => {
            p.life -= delta;
            if (p.life <= 0) { p.r.destroy(); return false; }
            if (p.blood) {
                p.vy += 720 * dt;
                p.r.x += p.vx * dt;
                p.r.y += p.vy * dt;
            }
            p.r.setAlpha((p.life / p.max) * 0.88);
            return true;
        });
    }

    trail(x, y, gauge) {
        if (gauge < 20) return;
        const col = gauge > 85 ? 0xff1100
                  : gauge > 60 ? 0xff4400
                  : gauge > 40 ? 0xff8822
                  : 0xffcc55;
        const sz = gauge > 80 ? Phaser.Math.Between(3, 6) : 2;
        const r = this.scene.add.rectangle(
            x + Phaser.Math.Between(-4, 4),
            y + Phaser.Math.Between(-7, 7),
            sz, sz, col, 0.82
        ).setDepth(4);
        this.particles.push({ r, life: 300, max: 300, blood: false });
    }

    blood(x, y, dmg) {
        // Scale particle count with damage but cap it
        const count = Math.min(35, 12 + Math.floor(dmg * 0.9));
        for (let i = 0; i < count; i++) {
            const sz  = Phaser.Math.Between(2, dmg > 25 ? 7 : 4);
            const ang = Math.random() * Math.PI * 2;
            const spd = 80 + Math.random() * 340 + dmg * 4;
            const r   = this.scene.add.rectangle(
                x + Phaser.Math.Between(-6, 6),
                y + Phaser.Math.Between(-10, 4),
                sz, sz,
                Phaser.Math.RND.pick([0xcc0000, 0xee1111, 0xff2222, 0xdd0000, 0xaa0000]),
                1
            ).setDepth(14);
            this.particles.push({
                r, life: 400 + Math.random() * 500, max: 900, blood: true,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 60,
            });
        }
        if (dmg > 20) {
            const bigCount = Math.min(10, Math.floor(dmg / 5));
            for (let i = 0; i < bigCount; i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 200 + Math.random() * 440;
                const r = this.scene.add.rectangle(
                    x, y,
                    Phaser.Math.Between(5, 13),
                    Phaser.Math.Between(5, 13),
                    0xff0000, 1
                ).setDepth(13);
                this.particles.push({
                    r, life: 700, max: 700, blood: true,
                    vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 130,
                });
            }
        }
    }

    killBlood(x, y) {
        for (let i = 0; i < 60; i++) {
            const sz  = Phaser.Math.Between(3, 14);
            const ang = Math.random() * Math.PI * 2;
            const spd = 100 + Math.random() * 700;
            const r   = this.scene.add.rectangle(x, y, sz, sz,
                Phaser.Math.RND.pick([0xcc0000, 0xee0000, 0xff1111, 0xaa0000, 0xff3333]),
                1
            ).setDepth(13);
            this.particles.push({
                r, life: 900 + Math.random() * 700, max: 1600, blood: true,
                vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 260,
            });
        }
    }

    impactLines(x, y, dmg, weaponCol) {
        const count = Math.min(20, 10 + Math.floor(dmg / 4));
        for (let i = 0; i < count; i++) {
            const ang = (i / count) * Math.PI * 2;
            const len = 20 + dmg * 0.9 + Math.random() * 22;
            const col = i % 3 === 0 ? 0xffffff : i % 3 === 1 ? (weaponCol || 0xff4400) : 0xffcc00;
            const ln  = this.scene.add.line(
                0, 0,
                x + Math.cos(ang) * 8,  y + Math.sin(ang) * 8,
                x + Math.cos(ang) * len, y + Math.sin(ang) * len,
                col, 1
            ).setDepth(16).setLineWidth(dmg > 25 ? 2 : 1);
            this.scene.tweens.add({
                targets: ln, alpha: 0,
                duration: 180 + dmg * 3,
                onComplete: () => ln.destroy(),
            });
        }
    }

    shockwave(x, y, dmg, col1 = 0xffffff, col2 = 0xff4400) {
        const ring = this.scene.add.circle(x, y, 5, col1, 0)
            .setDepth(15).setStrokeStyle(2, col1, 1);
        this.scene.tweens.add({
            targets: ring,
            scaleX: 1 + dmg * 0.18, scaleY: 1 + dmg * 0.18,
            alpha: 0, duration: 260 + dmg * 4, ease: 'Power2',
            onComplete: () => ring.destroy(),
        });
        if (dmg > 14) {
            const ring2 = this.scene.add.circle(x, y, 4, col2, 0)
                .setDepth(15).setStrokeStyle(3, col2, 0.8);
            this.scene.tweens.add({
                targets: ring2,
                scaleX: dmg * 0.26, scaleY: dmg * 0.26,
                alpha: 0, duration: 360,
                onComplete: () => ring2.destroy(),
            });
        }
    }

    slamShockwave(x, y, radius) {
        for (let i = 0; i < 3; i++) {
            const delay = i * 60;
            this.scene.time.delayedCall(delay, () => {
                const r = this.scene.add.circle(x, y, 10, 0xff4400, 0)
                    .setDepth(15).setStrokeStyle(4 - i, 0xff8800, 1);
                this.scene.tweens.add({
                    targets: r,
                    scaleX: (radius / 10) * (1 + i * 0.3),
                    scaleY: (radius / 10) * (1 + i * 0.3),
                    alpha: 0, duration: 400 + i * 80,
                    onComplete: () => r.destroy(),
                });
            });
        }
        for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            const len = radius * 0.8 + Math.random() * radius * 0.4;
            const ln  = this.scene.add.line(
                0, 0, x, y,
                x + Math.cos(ang) * len, y + Math.sin(ang) * len,
                0xff6600, 1
            ).setDepth(16).setLineWidth(2);
            this.scene.tweens.add({
                targets: ln, alpha: 0, duration: 500,
                onComplete: () => ln.destroy(),
            });
        }
    }

    damageNumber(x, y, dmg) {
        const isBig = dmg >= 30;
        const isMed = dmg >= 14;
        const col   = isBig ? '#ff0000' : isMed ? '#ff5500' : '#ffcc00';
        const fsz   = isBig ? '16px' : isMed ? '11px' : '8px';
        const t     = this.scene.add.text(x, y - 28, String(dmg), {
            fontSize: fsz, color: col,
            stroke: '#000', strokeThickness: isBig ? 5 : 3,
            fontFamily: 'monospace',
        }).setDepth(18).setOrigin(0.5);
        if (isBig) {
            t.setScale(0.4);
            this.scene.tweens.add({
                targets: t, scaleX: 1.6, scaleY: 1.6,
                y: t.y - 42, alpha: 0, duration: 900, ease: 'Back.Out',
                onComplete: () => t.destroy(),
            });
        } else {
            this.scene.tweens.add({
                targets: t, y: t.y - 30, alpha: 0, duration: 700, ease: 'Power2',
                onComplete: () => t.destroy(),
            });
        }
    }
}
