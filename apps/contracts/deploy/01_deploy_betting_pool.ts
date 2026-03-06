import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ReactiveBettingPool with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const houseWallet = process.env.HOUSE_WALLET || deployer.address;
  const houseFeeBps = 700; // 7% house fee

  const ReactiveBettingPool = await ethers.getContractFactory("ReactiveBettingPool");
  const bettingPool = await ReactiveBettingPool.deploy(houseWallet, houseFeeBps);
  await bettingPool.waitForDeployment();

  const address = await bettingPool.getAddress();
  console.log("✅ ReactiveBettingPool deployed to:", address);
  console.log("   House wallet:", houseWallet);
  console.log("   House fee:", houseFeeBps / 100, "%");

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
