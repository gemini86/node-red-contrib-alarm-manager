# node-red-contrib-alarm-manager

Monitors condition and status inputs and aggregates alarms conditions into a single emitter node.

## Nodes:

1. condition monitor
   - monitors numeric payloads and compares against configured high and low setpoints.
2. status monitor
   - monitors status strings or boolean true/false conditions.
3. alarm emitter
   - emits alarm objects containing all alarms stored in the alarm manager.
4. alarm persistence hook
   - allows alarms to be injected into the alarm manager from persistent storage within your flow.

## Details:

### _Condition Monitor_

**Inputs:**
  - payload (number):
    - the payload to be compared against the configured 'High Alarm' and 'Low Alarm' setpoints
  - enabled (boolean):
    - setting `msg.enabled` to `false` will clear any pending or sent alarms and will disable any further input to the node. Setting it to `true` again will restore functionality.

**Details:**

`msg.payload` is checked against the 'High Alarm' and 'Low Alarm' setpoints configured.
A payload that is greater than or equal to 'High Alarm' will trigger an alarm condition.
A payload that is less than or equal to 'Low Alarm' will trigger an alarm condition.
After an alarm condition is triggered, the node will wait for the 'Delay' period that is configured before sending the alarm to the alarm manager.
A payload that is between 'High Alarm' and 'Low Alarm' will clear the alarm condition. If the alarm is still pending (the node is still waiting for the 'Delay' period to elapse),
the alarm is immediately cleared. If an alarm condition has already been sent to the alarm manager before an alarm is cleared, the node will send a 'clear' alarm type to the alarm manager immediately.

### _Status Monitor_

**Inputs:**
- payload (string)
  	- the string that should be compared to the 'good' and 'bad' strings lists.
- enabled (boolean)
  - setting `msg.enabled` to `false` will clear any pending or sent alarms and will disable any further input to the node. Setting it to `true` again will restore functionality.
	
**Details:**

`msg.payload` is checked against the string or strings configured in the node. This is case sensitive.
Eg. when 'Good input string(s)' is configured as `'Connected, ONLINE'` and 'Bad input string(s)' is configured as `'Disconnected, Fault, OFFLINE'`, and input of `'OFFLINE'` is recived on the incoming `msg.payload`, the node will match the input to the value found in 'Bad input string(s)' and create an alarm condition. 

After the 'Delay to send alarm' period has passed, the alarm is sent to the alarm manager. If `'Connected'` is then received on the incoming `msg.payload`, it is found as a match in the 'Good input string(s)' list and the alarm is cleared in the alarm manager. Any input `msg.payload` that does not match a 'good' or 'bad' string is evaluated for truthiness. A falsey input will trigger an alarm condition (eg. `'', [], false, null, undefined`)). A truthy input will clear any alarms. 

If 'Ignore payloads that do not match good or bad lists' is checked, only boolean `true` or `false` will be accepted as an input other than strings matching those in the 'good' or 'bad' lists.

### _Alarm Emitter_

**Outputs:**

1. Alarm notification output
   - payload (object)
     - the current alarms stored in the alarm manager (sent every new alarm or alarm cleared, or when resend on interval is set.
2. Persistence storage output
    - payload (object)
      - all alarms as an object, sent whenever the alarm emitter would normally send. Use this to store alarms in a persistent storage.
3. Alarm event stream output
    - payload (object)
      - each alarm event as they are received from all input nodes. This is useful for keeping an alarm log.

### _Alarm Persistence Hook_

**Inputs:**
- payload (object) 
  -  the stored alarms object from your flows persistent storage. This will overwrite any alarms in the alarm manager. This
		will also reset the resend interval (if configured) and delayed send timer (if configured)
  - ##### note: this is a specific object generated from the alarm manager which contains all alarm objects.
- reset (boolean)
  - setting `msg.reset` to `true` will clear all alarms held in the alarm manager.