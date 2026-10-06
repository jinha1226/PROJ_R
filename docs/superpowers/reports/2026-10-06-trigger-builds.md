# Trigger builds implementation

## Rulings

- A six-second cooldown permits activations at 0, 6, 12: three in thirteen seconds including time zero. The plan's “twice” example conflicts with the specified cooldown; the cooldown wins.
- Chain cap counts five effect executions across recursive and sibling subscriptions, not five per subscription.
- New advanced classes inherit base HP and movement: the binding spec supplies neither additional HP nor movement numbers. Existing berserker/sniper values remain.
- Shock lasts until consumed. Its chain damage is 3; reaction neighbours use radius 1. These numbers are unspecified in the spec.
