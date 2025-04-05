import { task, types } from "hardhat/config";
import { Comptroller } from "contracts";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getComptrollerContract } from "../_utils";

const DEFAULT_CLOSE_FACTOR = "500000000000000000";
const DEFAULT_LIQUIDATION_INCENTIVE = "1080000000000000000";

task("comptroller/init", "Initialize Comptroller parameters")
  .addOptionalParam(
    "closeFactor",
    "The close factor value",
    DEFAULT_CLOSE_FACTOR,
    types.string
  )
  .addOptionalParam(
    "liquidationIncentive",
    "The liquidation incentive value",
    DEFAULT_LIQUIDATION_INCENTIVE,
    types.string
  )
  .setAction(async (args, hre) => {
    await setCloseFactor(hre, args.closeFactor);
    await setLiquidationIncentive(hre, args.liquidationIncentive);
  }); 

async function setCloseFactor(hre: HardhatRuntimeEnvironment, closeFactor: string): Promise<void> {
  const comptroller = await getComptrollerContract(hre);

  const currentCloseFactor = await comptroller.closeFactorMantissa();
  if (currentCloseFactor.toString() === closeFactor) {
    console.log(`Close factor is already set to ${closeFactor}!`);
    return;
  }

  console.log(`Setting close factor from ${currentCloseFactor} to ${closeFactor}...`);
  
  const tx = await comptroller._setCloseFactor(closeFactor);
  await tx.wait();

  console.log(`Close factor successfully set to ${closeFactor}`);
}

async function setLiquidationIncentive(hre: HardhatRuntimeEnvironment, liquidationIncentive: string): Promise<void> {
  const comptroller = await getComptrollerContract(hre);

  const currentLiquidationIncentive = await comptroller.liquidationIncentiveMantissa();
  if (currentLiquidationIncentive.toString() === liquidationIncentive) {
    console.log(`Liquidation incentive is already set to ${liquidationIncentive}!`);
    return;
  }

  console.log(`Setting liquidation incentive from ${currentLiquidationIncentive} to ${liquidationIncentive}...`);
  
  const tx = await comptroller._setLiquidationIncentive(liquidationIncentive);
  await tx.wait();

  console.log(`Liquidation incentive successfully set to ${liquidationIncentive}`);
}