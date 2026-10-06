# Trigger builds implementation

## Rulings

- A six-second cooldown permits activations at 0, 6, 12: three in thirteen seconds including time zero. The plan's “twice” example conflicts with the specified cooldown; the cooldown wins.
- Chain cap counts five effect executions across recursive and sibling subscriptions, not five per subscription.
- New advanced classes inherit base HP and movement: the binding spec supplies neither additional HP nor movement numbers. Existing berserker/sniper values remain.
- Shock lasts until consumed. Its chain damage is 3; reaction neighbours use radius 1. These numbers are unspecified in the spec.

## Task 1

Trigger subscriptions, shared five-effect recursion budget, cooldowns, attack/movement/crisis/combat/status emissions; nine statuses and three reactions. Tests were red on missing modules; TypeScript, lint and 406 unit tests passed. Commit: 4b443b0.

## Task 2

Five base kits, ten advanced kits, veteran, fifteen ultimates, build promotion rules, proficiency switching, companion ultimate choice. R replaces Q/W; the old R restart shortcut moves to F5. Shaft transfer keeps remaining ultimate and trigger cooldowns. Removed the skill and auto-skill modules. Existing skill tests now exercise their replacement behaviours.

Open numeric choices: meteor 24–32, judgement 22, piercing shot 18–24, shadow slashes ×2; all offensive aimed ultimates have range 10. Skeletons have 18 HP, fists, a 10-second lifetime; necromancer kill cap 2, army uncapped (one per corpse). Hunter roots use freeze's two-second hold. New advanced classes retain their base proficiency except hunter adds daggers and guardian drops great weapons.

Task 2 validation: missing-module red observed; TypeScript and 427 tests in 73 unit files passed. `roundHud` timed out under concurrent transform load in two intermediate runs, then passed both tests alone; the final unit run passed it as well.
