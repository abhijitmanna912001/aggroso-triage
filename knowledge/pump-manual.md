# Centrifugal Pump Manual

*This is a sample document written for a software assessment and is not manufacturer documentation.*

## 1.1 Normal operating limits

This section describes the normal operating limits of a centrifugal pump and the sensor values at which a warning or critical alarm applies.

| Sensor | Unit | Direction | Warning | Critical |
| --- | --- | --- | --- | --- |
| vibration | mm/s | high | 4.5 | 7.1 |
| bearing_temperature | °C | high | 70 | 85 |
| discharge_pressure | bar | low | 4.0 | 3.0 |
| suction_pressure | bar | low | 0.5 | 0.2 |

A "high" sensor alarms at or above the listed value, and a "low" sensor alarms at or below it.

## 2.1 Cavitation

Cavitation in a centrifugal pump is the formation and collapse of vapour bubbles in the liquid as it passes through the impeller.

**Symptoms:** Crackling or gravel-like noise from the casing, unstable discharge pressure, and vibration noticeably above its usual level.

**Possible causes:** Suction pressure may be too low for the liquid being pumped. A partly blocked suction line can contribute, and a liquid that is warmer than usual often makes it worse.

**Inspection steps:**
1. Compare suction pressure and discharge pressure with their usual levels.
2. Listen for crackling noise near the pump inlet while it runs.
3. Check the suction valve position and the liquid level in the source tank.
4. Isolate and lock out the pump first, then inspect the suction strainer and impeller eye for damage.

**Related sensors:** `suction_pressure`, `discharge_pressure`, `vibration`

**Escalate when:** Noise continues after suction conditions are corrected, or vibration or suction pressure reaches a critical value.

## 2.2 Bearing wear and overheating

Bearing wear and overheating in a centrifugal pump shows up as rising bearing temperature, often together with more vibration.

**Symptoms:** Bearing housing hotter than usual, a grinding or rumbling sound, and vibration noticeably above its usual level.

**Possible causes:** Lubricant may be low, old or contaminated. Bearings can be worn or poorly fitted, and shaft misalignment often accelerates wear.

**Inspection steps:**
1. Compare bearing temperature and vibration with their recent trend.
2. Check the bearing housing for leaking lubricant, discolouration or unusual noise while the pump runs.
3. Review the lubrication record against the manufacturer's specification.
4. Isolate and lock out the pump first, then check shaft play and rotate the shaft by hand to feel for roughness.

**Related sensors:** `bearing_temperature`, `vibration`

**Escalate when:** Bearing temperature or vibration reaches a critical value, or the housing smells burnt or smokes.

## 2.3 Mechanical seal leakage

Mechanical seal leakage on a centrifugal pump is liquid escaping along the shaft where the seal faces meet.

**Symptoms:** Drips or a wet patch near the shaft, residue on the seal gland, and in some cases a squealing noise.

**Possible causes:** Seal faces may be worn or scored. Dry running can damage them, shaft movement from misalignment or bearing wear often contributes, and solids in the liquid can wear the faces.

**Inspection steps:**
1. Look for the leak location and note its rate and the liquid colour without touching the seal.
2. Check whether leakage changes between running and standstill.
3. Review recent vibration and bearing temperature for signs of shaft movement.
4. Isolate and lock out the pump first, then inspect the seal and the shaft sleeve per the manufacturer's specification.

**Related sensors:** `vibration`, `bearing_temperature`, `discharge_pressure`

**Escalate when:** Leakage is continuous, the liquid is hazardous or hot, or a spray is visible.

## 2.4 Shaft misalignment

Shaft misalignment in a centrifugal pump means the pump shaft and the driver shaft are not on a common centreline.

**Symptoms:** Raised vibration, warm coupling or bearings, and uneven wear on the coupling.

**Possible causes:** Alignment may have shifted after maintenance. Pipe strain can pull the casing out of position, a loose or settled baseplate is often involved, and thermal growth can add to it.

**Inspection steps:**
1. Compare vibration and bearing temperature with their usual levels.
2. Look at the coupling guard area for dust from coupling wear, without removing the guard while running.
3. Check the baseplate and foundation bolts for visible looseness.
4. Isolate and lock out the pump first, then measure alignment per the manufacturer's specification.

**Related sensors:** `vibration`, `bearing_temperature`

**Escalate when:** Vibration reaches a critical value or the coupling shows visible damage.

## 2.5 Impeller wear or damage

Impeller wear or damage in a centrifugal pump reduces the head and flow the pump can deliver.

**Symptoms:** Lower discharge pressure than usual, reduced flow, noise from the casing, and vibration that can be uneven.

**Possible causes:** Abrasive solids may have worn the vanes. Cavitation can erode the impeller over time, corrosion is possible, and debris in the liquid can chip or bend vanes.

**Inspection steps:**
1. Compare discharge pressure and flow against the pump's usual performance.
2. Listen for rattling or rubbing noise from the casing.
3. Check upstream filtration for signs of solids.
4. Isolate and lock out the pump first, then open the casing and inspect the impeller for erosion, cracks or imbalance.

**Related sensors:** `discharge_pressure`, `vibration`, `suction_pressure`

**Escalate when:** Vibration reaches a critical value or discharge pressure is at or below its critical value.

## 2.6 Suction blockage or air ingress

Suction blockage or air ingress in a centrifugal pump starves the impeller of liquid and disturbs flow.

**Symptoms:** Low suction pressure, fluctuating discharge pressure, gurgling noise and a pump that may lose prime.

**Possible causes:** A strainer or inlet line may be partly blocked. A valve can be left partly closed, and loose fittings or a worn seal often let air in on the suction side.

**Inspection steps:**
1. Compare suction pressure with its usual level and watch for fluctuation.
2. Check that suction valves are in their normal position.
3. Look for visible leaks or bubbles at suction-side joints.
4. Isolate and lock out the pump first, then inspect and clean the strainer.

**Related sensors:** `suction_pressure`, `discharge_pressure`, `vibration`

**Escalate when:** The pump loses prime repeatedly or suction pressure is at or below its critical value.

## 2.7 Low discharge pressure or flow

Low discharge pressure or flow on a centrifugal pump means the pump is delivering less than its normal duty.

**Symptoms:** Discharge pressure below its usual level, reduced flow at the process, and sometimes a higher motor load.

**Possible causes:** The impeller may be worn, suction conditions may be poor, a discharge valve can be partly closed, and internal leakage or a wrong rotation direction are also possible.

**Inspection steps:**
1. Compare discharge and suction pressure with their usual levels.
2. Confirm valve positions on both sides of the pump.
3. Check that the pump is turning in the marked direction.
4. Isolate and lock out the pump first, then inspect the impeller and wear parts if the cause is not found.

**Related sensors:** `discharge_pressure`, `suction_pressure`, `vibration`

**Escalate when:** Discharge pressure is at or below its critical value, or the process cannot be supplied safely.

## 3.1 Routine inspection procedure

This routine inspection procedure for a centrifugal pump is done with the pump running and then, where needed, stopped.

Start with checks that do not open the equipment. Record discharge pressure, suction pressure, bearing temperature and vibration, and compare them with the previous record. Walk around the pump and listen for unusual noise. Look for leakage at the seal, flanges and drains, and check that guards are fitted and secure. Check the baseplate, coupling guard and pipework supports for visible looseness or damage. Note the lubricant level and condition where a sight glass is fitted. Write down anything that differs from the previous round, even if no alarm is active.

Only after these checks, and only if a closer look is needed, isolate and lock out the pump before removing any cover. Report abnormal findings to the maintenance supervisor.

## 3.2 Bearing lubrication check

This bearing lubrication check for a centrifugal pump confirms that the bearings have the right lubricant in good condition.

Begin with a visual check while the pump runs: look at the sight glass or oil level mark, and note any leakage around the bearing housing. Compare bearing temperature with its recent trend. Check the lubricant colour and clarity; milky, dark or gritty lubricant can indicate water or contamination. Use only the lubricant type and quantity given in the manufacturer's specification, and do not mix lubricant types.

If lubricant must be added or changed, or a housing must be opened, isolate and lock out the pump first. Record the date, the action taken and the technician's name. Recheck bearing temperature and vibration after the pump returns to service.

## 3.3 Vibration measurement procedure

This vibration measurement procedure for a centrifugal pump describes how a technician takes repeatable readings.

Measure with the pump running at its normal operating condition, so that results can be compared with earlier readings. Use the same measuring points each time, normally on the bearing housings of the pump and the driver, and take readings in the directions given in the manufacturer's specification. Keep the instrument firmly in contact with the housing and away from guards that can rattle. Record the value, the measuring point, the date and the operating condition.

Compare results with the vibration limits in section 1.1 and with the previous trend. A rising trend that is still below the warning value deserves a note for follow-up. Do not remove guards while the pump runs.

## 4.1 When to stop the pump and escalate

This section explains when a technician should stop a centrifugal pump and escalate to a supervisor.

Stop the pump by the normal stop control, following site procedure, and escalate when any of these occur: a critical value is reached for vibration or bearing temperature, or for discharge or suction pressure; smoke, a burning smell or sparks come from the pump or driver; a seal leak is spraying or involves a hazardous or hot liquid; there is a loud knocking or grinding noise; or the pump has lost prime and keeps losing it.

Report what was seen, the sensor values and the time. Do not restart the pump until a competent person has found the cause and agreed that restart is safe. Never bypass a trip, interlock or guard to keep the pump running.

## 4.2 Isolation and lockout before inspection

This section describes isolation and lockout of a centrifugal pump before any inspection that opens the equipment.

Before opening the casing, seal area, coupling or bearing housing, isolate and lock out the pump. Stop the driver and isolate its electrical supply at the point given by site procedure. Apply your personal lock and tag, and try the start control to confirm the pump cannot start. Close the suction and discharge valves and lock them where the site procedure requires.

Relieve any trapped pressure and drain the casing carefully, as the liquid may be hot or hazardous. Wear the protective equipment required by site procedure. Only the person who applied a lock removes it, after the work is complete, guards are refitted and the area is clear.
