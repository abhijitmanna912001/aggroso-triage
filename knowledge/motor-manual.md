# Electric Motor Manual

*This is a sample document written for a software assessment and is not manufacturer documentation.*

## 1.1 Normal operating limits

This section describes the normal operating limits of an electric motor and the sensor values at which a warning or critical alarm applies.

| Sensor | Unit | Direction | Warning | Critical |
| --- | --- | --- | --- | --- |
| winding_temperature | °C | high | 120 | 140 |
| vibration | mm/s | high | 4.5 | 7.1 |
| bearing_temperature | °C | high | 80 | 95 |
| current_imbalance | % | high | 5 | 10 |

A "high" sensor alarms at or above the listed value, and a "low" sensor alarms at or below it.

## 2.1 Winding overheating

Winding overheating in an electric motor means the stator windings run hotter than they normally do.

**Symptoms:** Winding temperature trending upward, a hot motor frame, a burnt smell, and sometimes frequent trips.

**Possible causes:** Overload may be driving the current up. Blocked ventilation or a failed cooling fan can trap heat, current imbalance or supply problems often add heating, and a high ambient temperature or degraded insulation can also contribute.

**Inspection steps:**
1. Compare winding temperature with its usual level and recent trend.
2. Check that the cooling fan turns and that air inlets and the frame fins are clear.
3. Compare current imbalance and the driven load with their usual levels.
4. Isolate and lock out the motor first, then inspect the windings and terminal box for discolouration.

**Related sensors:** `winding_temperature`, `current_imbalance`, `bearing_temperature`

**Escalate when:** Winding temperature reaches its critical value, or smoke or a strong burning smell appears.

## 2.2 Bearing wear and overheating

Bearing wear and overheating in an electric motor shows up as rising bearing temperature, often together with more vibration.

**Symptoms:** Bearing end hotter than usual, a grinding or humming noise from the bearing area, and vibration noticeably above its usual level.

**Possible causes:** Grease may be old, low or contaminated. Bearings can be worn, over-greased or poorly fitted, and misalignment or belt tension problems often accelerate wear.

**Inspection steps:**
1. Compare bearing temperature and vibration with their recent trend.
2. Check the bearing area for grease leakage, discolouration or noise while the motor runs.
3. Review the lubrication record against the manufacturer's specification.
4. Isolate and lock out the motor first, then rotate the shaft by hand to feel for roughness or play.

**Related sensors:** `bearing_temperature`, `vibration`, `winding_temperature`

**Escalate when:** Bearing temperature or vibration reaches its critical value, or the bearing area smokes.

## 2.3 Insulation degradation

Insulation degradation in an electric motor is the gradual loss of electrical insulation quality in the windings.

**Symptoms:** Lower insulation test results than previously recorded, a burnt smell, rising winding temperature, and tripping on earth faults.

**Possible causes:** Long-term heat may have aged the insulation. Moisture, dust or oil contamination can reduce it, and vibration or repeated starts often add stress.

**Inspection steps:**
1. Compare winding temperature and current imbalance with their usual levels.
2. Check the motor exterior and terminal box area for moisture, dirt or signs of overheating without opening it.
3. Review earlier insulation test records.
4. Isolate and lock out the motor first, then arrange an insulation resistance test as described in section 3.3.

**Related sensors:** `winding_temperature`, `current_imbalance`

**Escalate when:** Insulation test results are poor, the motor trips on earth fault, or winding temperature reaches its critical value.

## 2.4 Current imbalance

Current imbalance in an electric motor means the current in the three phases is not equal.

**Symptoms:** Imbalance reading above its usual level, a humming sound, extra heating, and vibration that can rise.

**Possible causes:** The supply voltage may be unbalanced. A loose or corroded connection can cause it, winding damage is possible, and an uneven load often makes it worse.

**Inspection steps:**
1. Compare current imbalance, winding temperature and vibration with their usual levels.
2. Check the starter or drive panel indications from outside for faults or alarms.
3. Look at the terminal box exterior for heat marks, without opening it.
4. Isolate and lock out the motor first, then inspect connections and terminals.

**Related sensors:** `current_imbalance`, `winding_temperature`, `vibration`

**Escalate when:** Current imbalance reaches its critical value, or the motor trips repeatedly.

## 2.5 Excessive vibration

Excessive vibration in an electric motor is shaking noticeably above its usual level on the frame or bearings.

**Symptoms:** Raised vibration readings, rattling or humming noise, loose fittings, and warm bearings.

**Possible causes:** Mounting bolts may be loose. Worn bearings or a rotor that is out of balance can be the cause, misalignment with the driven equipment is often involved, and a soft foot or electrical imbalance can contribute.

**Inspection steps:**
1. Compare vibration with its usual level and recent trend.
2. Check the base and mounting bolts for visible looseness.
3. Compare bearing temperature and current imbalance with their usual levels.
4. Isolate and lock out the motor first, then check coupling alignment and the bearings.

**Related sensors:** `vibration`, `bearing_temperature`, `current_imbalance`

**Escalate when:** Vibration reaches its critical value, or a loud knock or visible movement of the motor appears.

## 2.6 Overload and frequent tripping

Overload and frequent tripping in an electric motor means the motor draws more current than it should and its protection operates repeatedly.

**Symptoms:** Repeated protection trips, high winding temperature, a hot frame, and difficulty reaching normal speed.

**Possible causes:** The driven equipment may be jammed or overloaded. Supply problems can be responsible, a failing bearing often raises the load, and too many starts in a short time can overheat the windings.

**Inspection steps:**
1. Compare winding temperature and current imbalance with their usual levels.
2. Check the driven equipment for blockage or unusual noise.
3. Read the protection relay or drive indication without resetting it repeatedly.
4. Isolate and lock out the motor first, then turn the shaft by hand to check for binding.

**Related sensors:** `winding_temperature`, `current_imbalance`, `bearing_temperature`

**Escalate when:** Trips continue after one reset, or winding temperature reaches its critical value. Never bypass or alter the protection to keep the motor running.

## 2.7 Blocked ventilation or cooling

Blocked ventilation or cooling in an electric motor limits the airflow that removes heat from the frame and windings.

**Symptoms:** Winding temperature above its usual level, a hot frame, a fan that is slow or silent, and dust built up on the frame.

**Possible causes:** Dust or debris may block the air inlet or fins. The cooling fan can be damaged or loose, nearby objects often restrict airflow, and a high ambient temperature adds to the problem.

**Inspection steps:**
1. Compare winding temperature with its usual level.
2. Look at the air inlet, fan cover and frame fins for dirt or obstruction.
3. Check that the cooling fan turns and that nothing stands close to the motor.
4. Isolate and lock out the motor first, then clean the vents and inspect the fan.

**Related sensors:** `winding_temperature`, `bearing_temperature`

**Escalate when:** Winding temperature reaches its critical value, or the fan is damaged.

## 2.8 Misalignment with driven equipment

Misalignment with driven equipment means the motor shaft and the driven shaft are not on a common centreline.

**Symptoms:** Raised vibration, warm bearings, uneven wear on the coupling or belt, and noise that changes with load.

**Possible causes:** Alignment may have shifted after maintenance. Base or foundation movement can contribute, pipe strain on a driven pump is often involved, and thermal growth can add to it.

**Inspection steps:**
1. Compare vibration and bearing temperature with their usual levels.
2. Look for dust or wear marks near the coupling guard, without removing the guard while running.
3. Check the base and mounting bolts for visible looseness.
4. Isolate and lock out the motor first, then measure alignment per the manufacturer's specification.

**Related sensors:** `vibration`, `bearing_temperature`

**Escalate when:** Vibration reaches its critical value or the coupling shows visible damage.

## 3.1 Routine inspection procedure

This routine inspection procedure for an electric motor starts with checks made while the motor runs and without opening anything.

Record winding temperature, bearing temperature, vibration and current imbalance, and compare them with the previous record. Walk around the motor and listen for unusual noise. Check that the cooling fan turns and that vents and frame fins are clear. Look for grease leakage, burnt smell, discoloured paint and damaged cables or conduit. Check that guards are fitted and secure, and that mounting bolts look tight. Write down anything that differs from the previous round, even if no alarm is active.

Only after these checks, and only if a closer look is needed, isolate and lock out the motor before opening the terminal box or any cover. Report abnormal findings to the maintenance supervisor.

## 3.2 Bearing lubrication check

This bearing lubrication check for an electric motor confirms that the bearings have the right grease or oil in good condition.

Begin with a visual check while the motor runs: look for grease or oil leakage around the bearing ends and compare bearing temperature with its recent trend. Check the lubrication record to see when the bearings were last serviced. Use only the lubricant type and quantity given in the manufacturer's specification; too much grease can overheat a bearing as readily as too little, and types should not be mixed.

If lubricant must be added or a bearing cover opened, isolate and lock out the motor first, and keep clear of the fan and shaft. Record the date, the action taken and the technician's name. Recheck bearing temperature and vibration after the motor returns to service.

## 3.3 Insulation resistance test overview

This overview of the insulation resistance test for an electric motor explains what the test shows and how it is carried out safely.

The test applies a test voltage to the windings, using a suitable instrument, and measures the resistance to earth. It is done only by a competent person with the motor stopped, isolated and locked out, and with the supply cables disconnected as site procedure requires. Never test a motor that is running or connected to the supply.

Use the test voltage and acceptance criteria given in the manufacturer's specification. Record the result, the winding temperature, the date and the technician's name, and compare it with earlier results. A downward trend matters as much as a single value. Discharge the windings after the test before touching terminals. Report poor results to the maintenance supervisor.

## 4.1 When to stop the motor and escalate

This section explains when a technician should stop an electric motor and escalate to a supervisor.

Stop the motor by the normal stop control, following site procedure, and escalate when any of these occur: winding temperature, bearing temperature, vibration or current imbalance reaches its critical value; smoke, sparks or a strong burning smell come from the motor or terminal box; there is a loud knocking, grinding or scraping noise; the motor trips repeatedly; or the shaft or fan is visibly damaged.

Report what was seen, the sensor values and the time. Do not restart the motor until a competent person has found the cause and agreed that restart is safe. Never bypass a trip, protection relay or guard to keep the motor running.

## 4.2 Electrical isolation and lockout

This section describes electrical isolation and lockout of an electric motor before any inspection that opens the equipment.

Before opening the terminal box, fan cover or bearing covers, isolate and lock out the motor. Stop the motor and open the isolator or breaker at the point given by site procedure. Apply your personal lock and tag, and prove the supply is dead with an approved tester that you have checked on a known live source. Also isolate any separate supply, such as a space heater.

Make sure the driven equipment cannot turn the motor shaft, since a motor can generate voltage when turned. Wear the protective equipment required by site procedure. Only the person who applied a lock removes it, after the work is complete, covers are refitted and the area is clear.
