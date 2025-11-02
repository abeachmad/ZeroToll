import { GasSettled } from '../generated/ZeroTollPaymaster/ZeroTollPaymaster';
import { GasSettlement } from '../generated/schema';

export function handleGasSettled(event: GasSettled): void {
  let entity = new GasSettlement(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
  
  entity.user = event.params.user;
  entity.tokenStable = event.params.tokenStable;
  entity.costStable = event.params.costStable;
  entity.refundStable = event.params.refundStable;
  entity.timestamp = event.block.timestamp;
  entity.blockNumber = event.block.number;
  entity.txHash = event.transaction.hash;
  
  entity.save();
}
