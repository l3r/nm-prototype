/* Rachel */
game.RachelEntity = game.NPC.extend({
    // Keep track of the last direction key pressed.
    dir : c.RESET_DIR,

    // Keys being held: [ "left", "up", "right", "down" ]
    held : [ false, false, false, false ],
    last_held : [ false, false, false, false ],

    init : function init(x, y, settings) {
        // Call the constructor.
        this.parent(x, y, settings);

        // Adjust collision bounding box.
        this.adjustBoxShape(-1, 10, 15, 20);

        // Rachel's mass is always 1.
        this.body.setMass(1);

        // Register Chipmunk collision handlers.
        this.body.eachShape(function eachShape(shape) {
            shape.collision_type = c.COLLIDE_PLAYER;
            shape.setLayers(c.LAYER_NO_COIN | c.LAYER_NO_NPC | c.LAYER_NO_CHEST | c.LAYER_EXIT);
        });

        // Set the display to follow our position on both axis.
        me.game.viewport.follow(this.pos, me.game.viewport.AXIS.BOTH);
    },

    collect : function collect(arbiter, space) {
        switch (arbiter.b.data.name) {
            case "coin_gold":
                game.HUD.updateItemValue("coins", 100);
                publish("collect coin", [ 100 ]);
                me.audio.play("collect_coin");
                break;

            case "coin_silver":
                game.HUD.updateItemValue("coins", 1);
                publish("collect coin", [ 1 ]);
                me.audio.play("collect_coin");
                break;
        }

        // Remove the collectible item.
        space.addPostStepCallback(function post_collect() {
            arbiter.b.body.eachShape(function remove_shape(shape) {
                me.game.remove(me.game.getEntityByGUID(shape.data.GUID));
                space.removeShape(shape);
            });
            space.removeBody(arbiter.b.body);
        });

        // Returning false tells Chipmunk to stop processing this collision.
        // That means the object will not act as a wall!
        return false;
    },

    interactionCallback : function interactionCallback(data) {
        console.log(data);

        // DEBUG
        if (data.indexOf("still") >= 0) {
            game.state.loadLevel({
                to          : "rachels_room",
                music       : "bells",
                fade        : "black",
                duration    : 250
            });
        }
    },

    checkMovement : function checkMovement() {
        var self = this;

        var force = {
            x : 0,
            y : 0
        };
        var velocity = self.velocity;

        // Set the movement speed.
        if (!me.input.keyStatus("shift")) {
            // Walk.
            self.animationspeed = 6;
        }
        else {
            // Run.
            velocity *= 2;
            self.animationspeed = 3;
        }

        // Walking controls.
        c.DIR_NAMES.forEach(function forEach(dir_name, i) {
            if (me.input.isKeyPressed(dir_name)) {
                self.held[i] = true;
                self.standing = false;

                if (!self.last_held[i] || (self.dir == c.RESET_DIR)) {
                    self.dir = c[dir_name.toUpperCase()];
                    self.dir_name = dir_name;
                }
                self.setCurrentAnimation("walk_" + self.dir_name);

                var axis = (i % 2) ? "y" : "x";
                force[axis] = velocity * me.timer.tick;

                // Walking at a 45-degree angle will slow the axis velocity by
                // approximately 5/7. But we'll just use sin(45)  ;)
                if (me.input.isKeyPressed(c.DIR_NAMES[(i + 1) % 4]) ||
                    me.input.isKeyPressed(c.DIR_NAMES[(i + 3) % 4])) {
                    force[axis] *= self.walk_angle;
                }

                if (i < 2) {
                    force[axis] = -force[axis];
                }
            }
            else {
                self.held[i] = false;
                if (self.last_held[i]) {
                    self.dir = c.RESET_DIR;
                }
            }

            self.last_held[i] = self.held[i];
        });

        // Move body and detect collisions.
        self.body.applyForce(cp.v(force.x * self.forceConstant, force.y * -self.forceConstant), cp.vzero);

        if (~~self.body.vy !== 0) {
            game.wantsResort = true;
        }

        // Update animation if necessary.
        self.isDirty = (self.isDirty || (~~self.body.vx !== 0) || (~~self.body.vy !== 0));
        if (!self.isDirty && !self.standing) {
            // Force standing animation.
            self.stand();
        }
    },

    checkInteraction : function checkInteraction() {
        var self = this;

        // Interaction controls.
        if (me.input.isKeyPressed("action")) {
            var bb = self.body.shapeList[0].getBB();
            var hw = ~~((bb.r - bb.l) / 2);
            var hh = ~~((bb.t - bb.b) / 2);

            var v = [
                hw * ((self.dir_name === "left") ? -1 : ((self.dir_name === "right") ? 1 : 0)),
                hh * ((self.dir_name === "up")   ? -1 : ((self.dir_name === "down")  ? 1 : 0))
            ];
            var p = cp.v(
                self.body.p.x + v[0] + self.body.shapeList[0].data.offset.x,
                self.body.p.y - v[1] - self.body.shapeList[0].data.offset.y
            );
            var sensor = cm.bbNewForCircle(p, 3);
            cm.getSpace().bbQuery(sensor, c.LAYER_INTERACTIVE, 0, function onBBQuery(shape) {
                // DO SOMETHING!
                me.game.getEntityByGUID(shape.data.GUID).interact(self.interactionCallback);
            });
        }
    }
});