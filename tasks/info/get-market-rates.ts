import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { getAddressesOfMarkets, getComptrollerContract } from "../_utils";
import { getMarkets } from "../../config/markets";
import { getBlocksPerYear } from "../../config/networks";
import { CErc20 } from "index";
import { ethers, BigNumber } from "ethers";

/**
 * Converts a mantissa-based Compound rate to an APY percentage
 * Compound's rate is given as a value scaled by 1e18 that represents
 * an interest rate per block
 * 
 * Example: npx hardhat get-market-rates --network zen_testnet
 */
function calculateApy(ratePerBlock: BigNumber, blocksPerYear: number): string {
    // Early return for zero rate
    if (ratePerBlock.isZero()) {
        return "0.00%";
    }
    
    try {
        // Convert the rate to a proper decimal
        const ratePerBlockAsString = ethers.utils.formatUnits(ratePerBlock, 18);
        const ratePerBlockAsNumber = parseFloat(ratePerBlockAsString);
        
        // This is the standard formula: APY = ((1 + r)^n - 1) where:
        // r = rate per block
        // n = number of blocks per year
        const apy = (Math.pow(1 + ratePerBlockAsNumber, blocksPerYear) - 1) * 100;
        
        // Guard against NaN or Infinity
        if (!isFinite(apy)) {
            return "Error: Invalid rate calculation";
        }
        
        // Format to 2 decimal places
        return apy.toFixed(2) + "%";
    } catch (error) {
        console.error("Error calculating APY:", error);
        return "Error: Could not calculate APY";
    }
}

task("get-market-rates", "Display supply and borrow APY rates for all markets")
    .setAction(async (_, hre) => {
        const blocksPerYear = getBlocksPerYear(hre);
        console.log(`Using ${blocksPerYear} blocks per year for APY calculations`);
        
        const marketConfigs = await getMarkets(hre);
        const marketAddresses = await getAddressesOfMarkets(hre);
        
        console.log("\nCurrent Market Rates");
        console.log("====================");
        
        for (const [marketKey, marketConfig] of Object.entries(marketConfigs)) {
            const marketAddress = marketAddresses[marketKey];
            const market = await hre.ethers.getContractAt<CErc20>("CErc20", marketAddress);
            
            try {
                // Get the current supply and borrow rates per block
                const supplyRatePerBlock = await market.supplyRatePerBlock();
                const borrowRatePerBlock = await market.borrowRatePerBlock();
                
                // For diagnostic purposes, log the raw rates
                console.log(`\nMarket: ${marketKey}`);
                console.log(`Address: ${marketAddress}`);
                console.log(`Supply Rate Per Block: ${ethers.utils.formatUnits(supplyRatePerBlock, 18)}`);
                console.log(`Borrow Rate Per Block: ${ethers.utils.formatUnits(borrowRatePerBlock, 18)}`);
                
                // Calculate APY
                const supplyApy = calculateApy(supplyRatePerBlock, blocksPerYear);
                const borrowApy = calculateApy(borrowRatePerBlock, blocksPerYear);
                
                // Get the cash (liquidity) and total borrows
                const cash = await market.getCash();
                const totalBorrows = await market.totalBorrows();
                const tokenDecimals = await market.decimals();
                
                // Get utilization rate
                const totalLiquidity = cash.add(totalBorrows);
                const utilizationRate = totalLiquidity.gt(0) 
                    ? (totalBorrows.mul(100).div(totalLiquidity).toString() + "%")
                    : "0%";
                
                // Format cash and borrows with proper decimals
                const formattedCash = ethers.utils.formatUnits(cash, tokenDecimals);
                const formattedBorrows = ethers.utils.formatUnits(totalBorrows, tokenDecimals);
                
                // Get token symbol from the underlying token address
                const underlyingTokenSymbol = marketKey;
                
                console.log(`Supply APY: ${supplyApy}`);
                console.log(`Borrow APY: ${borrowApy}`);
                console.log(`Total Liquidity: ${formattedCash} ${underlyingTokenSymbol}`);
                console.log(`Total Borrows: ${formattedBorrows} ${underlyingTokenSymbol}`);
                console.log(`Utilization Rate: ${utilizationRate}`);
            } catch (err: any) {
                console.error(`Error fetching rates for ${marketKey}: ${err.message}`);
            }
        }
    }); 