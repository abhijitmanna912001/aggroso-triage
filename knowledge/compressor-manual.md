# Air Compressor Manual

*This is a sample document written for a software assessment and is not manufacturer documentation.*

## 1.1 Normal operating limits

This section describes the normal operating limits of an air compressor and the sensor values at which a warning or critical alarm applies.

| Sensor | Unit | Direction | Warning | Critical |
| --- | --- | --- | --- | --- |
| discharge_temperature | °C | high | 105 | 120 |
| oil_pressure | bar | low | 2.5 | 1.8 |
| discharge_pressure | bar | high | 8.5 | 9.5 |
| vibration | mm/s | high | 4.5 | 7.1 |

A "high" sensor alarms at or above the listed value, and a "low" sensor alarms at or below it.

## 2.1 High discharge temperature

High discharge temperature in an air compressor means the compressed air leaves the machine hotter than normal.

**Symptoms:** Discharge temperature trending upward, a hot cooler or pipework, and possibly a hot oil smell.

**Possible causes:** Cooling airflow may be restricted by a dirty cooler. Oil level or oil quality can be poor, an intake filter that is blocked often raises temperature, and a high ambient temperature or worn valves can also contribute.

**Inspection steps:**
1. Compare discharge temperature with its usual level and recent trend.
2. Check that cooling fans run and that air inlets and outlets around the machine are clear.
3. Look at the oil level indicator and for oil leaks.
4. Isolate, lock out and depressurize the compressor first, then inspect the cooler and intake filter.

**Related sensors:** `discharge_temperature`, `oil_pressure`, `discharge_pressure`

**Escalate when:** Discharge temperature reaches its critical value, or a burning smell or smoke appears.

## 2.2 Low oil pressure

Low oil pressure in an air compressor means the lubrication circuit is not delivering the oil pressure it normally does.

**Symptoms:** Oil pressure below its usual level, a low-oil alarm, and sometimes rising discharge temperature or new noise.

**Possible causes:** Oil level may be low. The oil filter can be clogged, oil may be degraded or diluted, and a worn oil pump or an internal leak is also possible.

**Inspection steps:**
1. Compare oil pressure with its usual level and recent trend.
2. Check the oil level indicator and look for external oil leaks.
3. Note the discharge temperature, since heat can thin oil.
4. Isolate, lock out and depressurize the compressor first, then inspect the oil filter and oil condition per the manufacturer's specification.

**Related sensors:** `oil_pressure`, `discharge_temperature`, `vibration`

**Escalate when:** Oil pressure is at or below its critical value. Do not keep running the compressor with critically low oil pressure.

## 2.3 Oil carryover into discharge air

Oil carryover in an air compressor is oil passing into the compressed air downstream of the machine.

**Symptoms:** Oily film in the air receiver, drains or downstream pipework, a falling oil level without visible leaks, and oily residue at air outlets.

**Possible causes:** The oil separator may be worn or saturated. Oil level can be too high, discharge temperature that is too high often thins oil and increases carryover, and a damaged return line is also possible.

**Inspection steps:**
1. Check the oil level and compare it with the usual running level.
2. Look at condensate drains and downstream filters for oil.
3. Compare discharge temperature with its usual level.
4. Isolate, lock out and depressurize the compressor first, then inspect the separator and its return line.

**Related sensors:** `discharge_temperature`, `oil_pressure`, `discharge_pressure`

**Escalate when:** Oil reaches downstream equipment or a process that must stay oil-free, or the oil level falls quickly.

## 2.4 Moisture in discharge air

Moisture in the discharge air of an air compressor is water condensing in the receiver, pipework or tools.

**Symptoms:** Water at drain points, wet or rusty pipework, and water spitting from outlets.

**Possible causes:** The aftercooler or dryer may not be working as intended. Condensate drains can be blocked or stuck closed, humid ambient air often adds to the load, and a very low discharge temperature can promote condensation.

**Inspection steps:**
1. Check condensate drains for normal discharge and look for blockage.
2. Check that the dryer, where fitted, is running and its indicators are normal.
3. Compare discharge temperature with its usual level.
4. Isolate, lock out and depressurize the compressor first, then inspect the aftercooler and drain valves.

**Related sensors:** `discharge_temperature`, `discharge_pressure`

**Escalate when:** Water reaches instruments, tools or a process that must stay dry, or drains cannot be cleared.

## 2.5 Excessive vibration

Excessive vibration in an air compressor is shaking noticeably above its usual level on the machine or its base.

**Symptoms:** Raised vibration readings, rattling noise, loose fittings, and cracked or loosened pipework.

**Possible causes:** Mounting bolts may have loosened. Worn bearings or an unbalanced rotating part can be the cause, misalignment with the driver is often involved, and worn valves or piston rings can add pulsation.

**Inspection steps:**
1. Compare vibration with its usual level and recent trend.
2. Check the base, mounting bolts and connected pipework for visible looseness.
3. Listen for knocking or grinding noise to help locate the source.
4. Isolate, lock out and depressurize the compressor first, then check the coupling and bearings.

**Related sensors:** `vibration`, `discharge_temperature`, `oil_pressure`

**Escalate when:** Vibration reaches its critical value, or a loud knock or visible movement of the machine appears.

## 2.6 Valve or piston ring wear

Valve or piston ring wear in an air compressor reduces how well it compresses air and holds pressure.

**Symptoms:** Longer time to reach pressure, discharge temperature above its usual level, more oil in the air, and valve or knocking noise.

**Possible causes:** Normal wear over time may be responsible. Poor oil quality, dirt entering through the intake, and overheating can accelerate wear.

**Inspection steps:**
1. Compare time to reach pressure and discharge temperature with their usual levels.
2. Listen for abnormal noise from the compression section.
3. Check the oil for signs of contamination.
4. Isolate, lock out and depressurize the compressor first, then inspect valves and rings per the manufacturer's specification.

**Related sensors:** `discharge_temperature`, `discharge_pressure`, `vibration`

**Escalate when:** Discharge temperature or vibration reaches its critical value, or the compressor can no longer reach working pressure.

## 2.7 Intake filter restriction

Intake filter restriction in an air compressor is a clogged filter that limits the air drawn into the machine.

**Symptoms:** Lower output than usual, longer time to reach pressure, discharge temperature above its usual level, and a filter indicator showing restriction.

**Possible causes:** Dust, fibres or debris may have built up in the element. A dusty environment can speed this up, and a damp element often clogs faster.

**Inspection steps:**
1. Check the filter restriction indicator, where fitted.
2. Look at the filter housing from outside for damage or heavy dirt.
3. Compare discharge temperature and discharge pressure with their usual levels.
4. Isolate, lock out and depressurize the compressor first, then remove and inspect the element.

**Related sensors:** `discharge_temperature`, `discharge_pressure`

**Escalate when:** The element is damaged or soaked with oil, or dirt may have passed into the compressor.

## 2.8 Overpressure and relief valve lifting

Overpressure in an air compressor is system pressure rising above its normal working level, and the relief valve lifting is the safety device responding.

**Symptoms:** Discharge pressure near or above its limits, a loud hiss from the relief valve, and the compressor not unloading as expected.

**Possible causes:** The pressure control or unloading function may not be working. A closed downstream valve can trap pressure, and a blocked sensing line is also possible.

**Inspection steps:**
1. Read discharge pressure and compare it with the limits in section 1.1.
2. Keep clear of the relief valve outlet and note whether it is still venting.
3. Check that downstream valves are in their normal position.
4. Isolate, lock out and depressurize the compressor first, then inspect the pressure control components.

**Related sensors:** `discharge_pressure`, `discharge_temperature`

**Escalate when:** Discharge pressure reaches its critical value or the relief valve lifts repeatedly. Never adjust, block or bypass a relief valve.

## 3.1 Routine inspection procedure

This routine inspection procedure for an air compressor starts with checks made while the machine runs and without opening anything.

Record discharge temperature, oil pressure, discharge pressure and vibration, and compare them with the previous record. Walk around the machine and listen for unusual noise. Look for oil leaks, loose fittings and damaged pipework. Check that guards and covers are fitted, that cooling air paths are clear, and that the intake filter indicator, where fitted, is normal. Confirm that condensate drains are discharging. Note the oil level indicator reading. Write down anything that differs from the previous round, even if no alarm is active.

Only after these checks, and only if a closer look is needed, isolate, lock out and depressurize the compressor before removing any cover. Report abnormal findings to the maintenance supervisor.

## 3.2 Oil level and oil quality check

This oil level and oil quality check for an air compressor confirms there is enough oil and that it is in good condition.

Check the oil level at the indicator with the machine in the state given in the manufacturer's specification. Compare it with the usual level. Look at the oil colour and clarity: milky oil can indicate water, dark oil or a burnt smell can indicate overheating, and particles can indicate wear. Note any oil on the outside of the machine, which may point to a leak.

Use only the oil type specified by the manufacturer, and do not mix types. If oil must be added, drained or sampled from a pressurized system, isolate, lock out and depressurize the compressor first. Record the date, the action taken and the technician's name, then recheck oil pressure after restart.

## 3.3 Intake filter and cooler inspection

This intake filter and cooler inspection for an air compressor checks that air can flow freely into the machine and across the cooler.

First check from outside: read the filter indicator, look at the filter housing and the cooler fins for dirt, and check that the cooling fan turns freely when the machine is running normally. Note discharge temperature and compare it with its usual level.

To inspect or clean the element or the cooler, isolate, lock out and depressurize the compressor first and let hot parts cool. Replace a damaged or oil-soaked element rather than cleaning it. Clean cooler fins gently, following the manufacturer's specification, and do not use methods that bend the fins. Refit all covers and guards, and record the work.

## 4.1 When to stop the compressor and escalate

This section explains when a technician should stop an air compressor and escalate to a supervisor.

Stop the compressor by the normal stop control, following site procedure, and escalate when any of these occur: discharge temperature, oil pressure, discharge pressure or vibration reaches its critical value; smoke, a burning smell or sparks come from the machine; the relief valve lifts repeatedly or does not reseat; oil is spraying from a leak; or a loud knocking or grinding noise begins.

Report what was seen, the sensor values and the time. Do not restart the compressor until a competent person has found the cause and agreed that restart is safe. Never adjust, block or bypass a relief valve, trip or guard to keep the compressor running.

## 4.2 Isolation and depressurization before inspection

This section describes isolation and depressurization of an air compressor before any inspection that opens the equipment.

Before removing any cover, filter housing, valve or line, isolate and lock out the compressor. Stop the machine and isolate its electrical supply at the point given by site procedure. Apply your personal lock and tag, and try the start control to confirm it cannot start. Close and lock the outlet isolation valve where site procedure requires.

Release stored pressure from the machine and the receiver through the vent or drain provided, slowly and away from people, and confirm the pressure gauge reads zero. Allow hot parts and oil to cool. Only the person who applied a lock removes it, after the work is complete, guards are refitted and the area is clear.
