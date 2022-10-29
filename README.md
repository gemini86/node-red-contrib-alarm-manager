# node-red-contrib-alarm-manager

Monitors condition and status inputs and aggregates alarms conditions into a single emitter node.

### Nodes

- : condition monitor : receives number inputs and compares against the configured high/low limit setpoints.

- : status monitor : receives string or number inputs and compares against the configured list of 'good'/'bad' values.
- : alarm emitter : 

***
**_NOTE:_** Each can be configured to delay the sending of an alarm condition to the manager until the condition has been present for a certain amount of time. |
Each node can also be enabled or disabled via the message sent to the input.
***

### Details


### References

 - [Twitter API docs]() - full description of `msg.tweet` property
 - [GitHub]() - the nodes github repository
