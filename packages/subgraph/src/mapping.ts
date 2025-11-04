import { GasSettled } from '../generated/ZeroTollPaymaster/ZeroTollPaymaster';
import { GasSettlement } from '../generated/schema';

export function handleGasSettled(event: GasSettled): void {
  let entity = new GasSettlement(event.transaction.hash.toHex() + '-' + event.logIndex.toString());
  
  entity.user = event.params.user;
  entity.feeToken = event.params.feeToken;
  entity.costInFeeToken = event.params.costInFeeToken;
  entity.refundInFeeToken = event.params.refundInFeeToken;
  entity.feeMode = event.params.feeMode.toString();
  entity.oracleSource = event.params.oracleSource.toString();
  entity.timestamp = event.block.timestamp;
  entity.blockNumber = event.block.number;
  entity.txHash = event.transaction.hash;
  
  entity.save();
}
