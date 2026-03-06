import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ReactiveSponsorship with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const houseWallet = process.env.HOUSE_WALLET || deployer.address;

  const ReactiveSponsorship = await ethers.getContractFactory("ReactiveSponsorship");
  const sponsorship = await ReactiveSponsorship.deploy(houseWallet);
  await sponsorship.waitForDeployment();

  const address = await sponsorship.getAddress();
  console.log("✅ ReactiveSponsorship deployed to:", address);
  console.log("   House wallet:", houseWallet);

  // If betting pool address is known, set it
  const bettingPoolAddress = process.env.BETTING_POOL_ADDRESS;
  if (bettingPoolAddress) {
    const tx = await sponsorship.setBettingPool(bettingPoolAddress);
    await tx.wait();
    console.log("   Betting pool linked:", bettingPoolAddress);
  }

  return address;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
