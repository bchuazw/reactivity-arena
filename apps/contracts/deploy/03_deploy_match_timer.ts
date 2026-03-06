import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ReactiveMatchTimer with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Betting pool address should be set from previous deployment
  const bettingPoolAddress = process.env.BETTING_POOL_ADDRESS || ethers.ZeroAddress;

  const ReactiveMatchTimer = await ethers.getContractFactory("ReactiveMatchTimer");
  const matchTimer = await ReactiveMatchTimer.deploy(bettingPoolAddress);
  await matchTimer.waitForDeployment();

  const address = await matchTimer.getAddress();
  console.log("✅ ReactiveMatchTimer deployed to:", address);
  console.log("   Betting pool:", bettingPoolAddress);

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
