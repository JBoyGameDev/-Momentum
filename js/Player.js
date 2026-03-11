class Player {
    constructor(scene, x, y, weaponId) {
        this.scene     = scene;
        this.weaponDef = C.WEAPONS[weaponId] || C.WEAPONS.sword;
        if (!scene.textures.exists('player')) Player._makeTexture(scene);
        this.sprite = scene.physics.add.sprite(x, y, 'player').setDepth(6);
        this.sprite.body.setGravityY(C.GRAVITY);
        this.sprite.body.setMaxVelocityX(C.MAX_VEL_X);
        this.sprite.body.setCollideWorldBounds(true);
        // Allow falling through bottom so lava kill triggers at LAVA_Y
        this.sprite.body.checkCollision.down = false;

        this.swordGfx  = scene.add.graphics().setDepth(7);
        this.facing    = 1;
        this.gauge     = 0;
        this.airJumps  = 0;
        this.dashing   = false; this.dashTimer = 0; this.dashCd = 0;
        this.wallSliding = false; this.wallOnWall = 0; this.wallCoyote = 0;
        this.attacking = false; this.atkTimer = 0; this.atkCd = 0;
        this.hitCd     = 0;
        this.sliding   = false;
        this.slamming  = false;
        this.trailTick = 0;
        this.kills     = 0;
        this.axeHitGlow = 0;
        this.dead      = false;
    }

    static _makeTexture(scene) {
        const g = scene.make.graphics({ add: false });
        // Head - flesh
        g.fillStyle(0xe8c080); g.fillRect(3, 0, 8, 7);
        // Helmet visor - black with teal slit (Doom HUD)
        g.fillStyle(0x111111); g.fillRect(3, 1, 8, 4);
        g.fillStyle(0x00ffcc); g.fillRect(4, 2, 6, 2);
        // Armor body - bright Doomguy green
        g.fillStyle(0x44cc44); g.fillRect(2, 7, 10, 9);
        // Chest highlight
        g.fillStyle(0x66ee66); g.fillRect(3, 7, 8, 3);
        // Shoulder pads - dark green
        g.fillStyle(0x226622); g.fillRect(0, 7, 3, 5);
        g.fillStyle(0x226622); g.fillRect(11, 7, 3, 5);
        // Arms
        g.fillStyle(0x44cc44); g.fillRect(0, 12, 3, 4);
        g.fillStyle(0x44cc44); g.fillRect(11, 12, 3, 4);
        // Legs
        g.fillStyle(0x1a4a1a); g.fillRect(2, 16, 4, 6);
        g.fillStyle(0x1a4a1a); g.fillRect(8, 16, 4, 6);
        // Boots
        g.fillStyle(0x333333); g.fillRect(2, 19, 4, 3);
        g.fillStyle(0x333333); g.fillRect(8, 19, 4, 3);
        g.generateTexture('player', 14, 22); g.destroy();
    }

    update(delta, keys, enemies, effects) {
        if (this.dead) return;

        const body      = this.sprite.body;
        const onGround  = body.blocked.down;
        const onLeft    = body.blocked.left;
        const onRight   = body.blocked.right;
        const touchWall = onLeft || onRight;

        if (onGround) { this.airJumps = 0; this.slamming = false; }

        if (this.dashTimer  > 0) this.dashTimer  -= delta;
        if (this.dashCd     > 0) this.dashCd     -= delta;
        if (this.atkTimer   > 0) this.atkTimer   -= delta;
        if (this.atkCd      > 0) this.atkCd      -= delta;
        if (this.hitCd      > 0) this.hitCd      -= delta;
        if (this.wallCoyote > 0) this.wallCoyote  -= delta;
        if (this.axeHitGlow > 0) this.axeHitGlow  -= delta;
        if (this.dashTimer  <= 0) this.dashing   = false;
        if (this.atkTimer   <= 0) this.attacking = false;

        const goLeft  = keys.left.isDown;
        const goRight = keys.right.isDown;
        const goDown  = keys.down.isDown;
        const jumpJD  = Phaser.Input.Keyboard.JustDown(keys.up);
        const dashJD  = Phaser.Input.Keyboard.JustDown(keys.x);
        const atkJD   = Phaser.Input.Keyboard.JustDown(keys.z);

        if (goLeft)  this.facing = -1;
        if (goRight) this.facing =  1;

        // WALL SLIDE
        this.wallSliding = false;
        if (touchWall && !onGround && body.velocity.y > -30) {
            this.wallSliding = true;
            this.wallOnWall  = onLeft ? -1 : 1;
            this.wallCoyote  = 130;
            body.setVelocityY(Math.min(body.velocity.y, C.WALL_SLIDE_V));
        } else if (this.wallCoyote > 0 && !onGround && !touchWall) {
            this.wallSliding = true;
        }

        // GROUND SLIDE
        this.sliding = onGround && goDown && Math.abs(body.velocity.x) > 60;

        // DASH
        if (dashJD && this.dashCd <= 0) {
            this.dashing = true; this.dashTimer = C.DASH_MS; this.dashCd = C.DASH_CD;
            body.setVelocityX(this.facing * C.DASH_VEL);
            if (!onGround) body.setVelocityY(body.velocity.y * 0.1);
            this.scene.cameras.main.shake(55, 0.005);
        }

        // HORIZONTAL
        if (!this.dashing && !this.slamming) {
            const accel = onGround ? C.RUN_ACCEL : C.AIR_ACCEL;
            if (goLeft)       { body.setAccelerationX(-accel); }
            else if (goRight) { body.setAccelerationX(accel); }
            else {
                body.setAccelerationX(0);
                if (this.sliding)  body.setDragX(C.SLIDE_DRAG);
                else if (onGround) body.setDragX(C.GROUND_DRAG);
                else               body.setDragX(C.AIR_DRAG);
            }
            if (onGround && !this.sliding) {
                const vx = body.velocity.x;
                if (Math.abs(vx) > C.MAX_RUN)
                    body.setVelocityX(Phaser.Math.Linear(vx, Math.sign(vx) * C.MAX_RUN, 0.055));
            }
        } else if (this.slamming) {
            body.setAccelerationX(0); body.setDragX(10);
        } else {
            body.setAccelerationX(0); body.setDragX(0);
        }

        // JUMP / WALL KICK
        if (jumpJD) {
            if (onGround) {
                body.setVelocityY(C.JUMP_VEL); this.airJumps = 0;
            } else if (this.wallSliding || touchWall) {
                body.setVelocityX(-this.wallOnWall * C.WALL_KICK_X);
                body.setVelocityY(C.WALL_KICK_Y);
                this.facing = -this.wallOnWall; this.airJumps = 0; this.wallCoyote = 0;
                this.scene.cameras.main.shake(70, 0.006);
            } else if (this.airJumps < C.MAX_AIR_JUMPS) {
                body.setVelocityY(C.AIR_JUMP_VEL); this.airJumps++;
            }
        }

        // HAMMER SLAM
        if (this.weaponDef.id === 'hammer' && atkJD && goDown && !onGround && !this.slamming) {
            this.slamming = true; this.attacking = false; this.atkTimer = 0;
            body.setVelocityX(body.velocity.x * 0.3);
            body.setVelocityY(this.weaponDef.slamVel);
            body.setAccelerationX(0);
            this.scene.cameras.main.shake(80, 0.007);
        }
        if (this.slamming && onGround) this._doSlamLanding(enemies, effects);

        // NORMAL ATTACK
        const canAtk = atkJD && this.atkCd <= 0 && !this.slamming;
        if (canAtk && !(this.weaponDef.id === 'hammer' && goDown && !onGround)) {
            this.attacking = true;
            this.atkTimer  = this.weaponDef.atkDur;
            this.atkCd     = this.weaponDef.atkCd;
            if (this.weaponDef.gaugeCost) {
                this.gauge = Math.max(0, this.gauge - this.weaponDef.gaugeCost);
            }
            if (this.weaponDef.id === 'sword' && !onGround)
                body.setVelocityX(this.facing * this.weaponDef.lungeVel);
        }

        // SPEED GAUGE
        const vx = Math.abs(body.velocity.x), vy = Math.abs(body.velocity.y);
        const totalV = Math.sqrt(vx * vx + vy * vy * 0.25);
        const target = Math.min((totalV / C.MAX_VEL_X) * 100, 100);
        this.gauge += (target - this.gauge) * (target > this.gauge ? 0.22 : 0.03);
        this.gauge  = Phaser.Math.Clamp(this.gauge, 0, 100);

        this._drawWeapon(enemies, effects, onGround);

        // TRAIL
        this.trailTick -= delta;
        if (this.gauge > 20 && this.trailTick <= 0) {
            effects.trail(this.sprite.x, this.sprite.y, this.gauge);
            this.trailTick = Math.max(6, 80 - this.gauge * 0.75);
        }

        // TINT
        this.sprite.setFlipX(this.facing === -1);
        if      (this.slamming)    this.sprite.setTint(0xff8800);
        else if (this.wallSliding) this.sprite.setTint(0x88ffff);
        else if (this.sliding)     this.sprite.setTint(0xaaffaa);
        else if (this.dashing)     this.sprite.setTint(0xffffff);
        else if (this.gauge > 80)  this.sprite.setTint(0xffdd00);
        else                       this.sprite.clearTint();

        // LAVA DEATH
        if (this.sprite.y > C.LAVA_Y && !this.dead) {
            this.dead = true;
            this.scene.events.emit('playerDied');
        }
    }

    _drawWeapon(enemies, effects, onGround) {
        this.swordGfx.clear();
        const px = this.sprite.x, py = this.sprite.y;
        const wpn = this.weaponDef;

        if (this.attacking) {
            const prog  = 1 - this.atkTimer / wpn.atkDur;
            const baseA = this.facing === 1 ? -2.0 : Math.PI + 2.0;
            const sweep = this.facing === 1 ? 4.0 : -4.0;
            const ang   = baseA + sweep * prog;
            const tipX  = px + Math.cos(ang) * wpn.radius;
            const tipY  = py + Math.sin(ang) * (wpn.radius * 0.7);

            if (wpn.id === 'scythe') {
                this.swordGfx.lineStyle(3, 0x886622, 0.9);
                this.swordGfx.lineBetween(px, py + 4, px - this.facing * 18, py + 16);
                this.swordGfx.lineStyle(4, wpn.swingCol, 0.95);
                this.swordGfx.beginPath();
                this.swordGfx.arc(px, py, wpn.radius, baseA, ang, this.facing !== 1);
                this.swordGfx.strokePath();
                if (this.gauge > 30) {
                    this.swordGfx.lineStyle(8, wpn.glowCol, 0.15);
                    this.swordGfx.beginPath();
                    this.swordGfx.arc(px, py, wpn.radius + 4, baseA, ang, this.facing !== 1);
                    this.swordGfx.strokePath();
                }
            } else {
                const sw = (wpn.id === 'hammer' ? 5 : wpn.id === 'axe' ? 3 : 2) + this.gauge * 0.035;
                this.swordGfx.lineStyle(sw, wpn.swingCol, 0.95);
                this.swordGfx.beginPath();
                this.swordGfx.arc(px, py, wpn.radius, baseA, ang, this.facing !== 1);
                this.swordGfx.strokePath();
                if (this.gauge > 45) {
                    this.swordGfx.lineStyle(sw + 3, wpn.glowCol, 0.18);
                    this.swordGfx.beginPath();
                    this.swordGfx.arc(px, py, wpn.radius + 3, baseA, ang, this.facing !== 1);
                    this.swordGfx.strokePath();
                }
            }

            this.swordGfx.fillStyle(0xffffff, 0.9);
            this.swordGfx.fillCircle(tipX, tipY, 2 + this.gauge * 0.025);

            if (wpn.id === 'axe' && this.axeHitGlow > 0) {
                const gl = Math.min(1, this.axeHitGlow / 400);
                const sw = 3 + this.gauge * 0.035;
                this.swordGfx.lineStyle(sw + 5, wpn.glowCol, gl * 0.35);
                this.swordGfx.beginPath();
                this.swordGfx.arc(px, py, wpn.radius + 6, baseA, ang, this.facing !== 1);
                this.swordGfx.strokePath();
            }

            if (this.hitCd <= 0) {
                const midAng = baseA + sweep * (prog * 0.5);
                const midX   = px + Math.cos(midAng) * wpn.radius * 0.7;
                const midY   = py + Math.sin(midAng) * wpn.radius * 0.5;
                const hitRad = wpn.radius + 6;
                enemies.forEach(d => {
                    if (!d.active) return;
                    const distTip = Phaser.Math.Distance.Between(tipX, tipY, d.x, d.y);
                    const distMid = Phaser.Math.Distance.Between(midX, midY, d.x, d.y);
                    if (distTip < hitRad || distMid < hitRad * 0.75) {
                        const dmg = this._calcDamage();
                        const dir = px < d.x ? 1 : -1;
                        const hit = d.takeDamage(dmg, dir * (180 + this.gauge * 3), -200 - dmg * 2);
                        if (hit) {
                            this.hitCd = 90;
                            this._onHit(dmg, d.x, d.y, effects);
                            if (wpn.id === 'scythe' && !d.alive) this.atkCd = 0;
                        }
                    }
                });
            }

        } else if (this.slamming) {
            this.swordGfx.lineStyle(5, wpn.swingCol, 0.9);
            this.swordGfx.lineBetween(px, py - 6, px, py - 26);
            this.swordGfx.fillStyle(wpn.swingCol, 1);
            this.swordGfx.fillRect(px - 8, py - 32, 16, 8);
        } else {
            const idleA = this.facing === 1 ? 0.5 : Math.PI - 0.5;
            const col   = wpn.id === 'axe' && this.axeHitGlow > 100 ? wpn.glowCol : wpn.swingCol;
            if (wpn.id === 'scythe') {
                this.swordGfx.lineStyle(2, col, 0.22);
                this.swordGfx.lineBetween(px, py + 2, px + Math.cos(idleA) * 16 * this.facing, py + Math.sin(idleA) * 12);
                this.swordGfx.lineStyle(1, col, 0.18);
                this.swordGfx.lineBetween(px, py + 2, px - this.facing * 10, py + 14);
            } else {
                this.swordGfx.lineStyle(wpn.id === 'hammer' ? 4 : 2, col, 0.25);
                this.swordGfx.lineBetween(px, py + 2, px + Math.cos(idleA) * 14 * this.facing, py + Math.sin(idleA) * 10);
            }
        }
    }

    _doSlamLanding(enemies, effects) {
        this.slamming = false;
        const px = this.sprite.x, py = this.sprite.y;
        const wpn = this.weaponDef;
        this.sprite.body.setVelocityY(wpn.slamBounce);
        effects.slamShockwave(px, py, wpn.slamRadius);
        this.scene.cameras.main.shake(180, 0.014);
        this.scene.cameras.main.flash(70, 255, 100, 0, false);
        enemies.forEach(d => {
            if (!d.active) return;
            const dist = Phaser.Math.Distance.Between(px, py, d.x, d.y);
            if (dist < wpn.slamRadius) {
                const falloff = 1 - dist / wpn.slamRadius;
                const dmg = Math.round(this._calcDamage() * 1.4 * falloff);
                const dir = px < d.x ? 1 : -1;
                d.takeDamage(dmg, dir * 280 * falloff, -300 * falloff);
                if (dmg > 0) {
                    effects.blood(d.x, d.y, dmg);
                    effects.impactLines(d.x, d.y, dmg, wpn.glowCol);
                    effects.damageNumber(d.x, d.y, dmg);
                }
            }
        });
    }

    _calcDamage() {
        const wpn = this.weaponDef;
        return Math.max(wpn.dmgMin, Math.round(wpn.dmgMin + (this.gauge / 100) * (wpn.dmgMax - wpn.dmgMin)));
    }

    _onHit(dmg, hx, hy, effects) {
        const wpn = this.weaponDef;
        effects.blood(hx, hy, dmg);
        effects.impactLines(hx, hy, dmg, wpn.glowCol);
        effects.shockwave(hx, hy, dmg, 0xffffff, wpn.glowCol);
        effects.damageNumber(hx, hy, dmg);
        this.scene.cameras.main.shake(120 + dmg * 4, 0.006 + dmg * 0.00045);
        if (dmg > 25) this.scene.cameras.main.flash(60, 255, 60, 0, false);
        if (wpn.id === 'axe') { this.gauge = Math.min(100, this.gauge + wpn.speedBonus); this.axeHitGlow = 600; }
        this.scene.events.emit('playerHit', dmg);
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
}