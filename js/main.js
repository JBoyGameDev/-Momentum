new Phaser.Game({
    type:   Phaser.AUTO,
    width:  800,
    height: 480,
    backgroundColor: '#050505',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade:  { gravity: { y: 0 }, debug: false },
    },
    scene:  [MenuScene, GameScene, UIScene],
    scale: {
        mode:       Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    parent: document.body,
});
