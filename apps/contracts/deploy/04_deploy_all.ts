import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

async function main() {
  const [deployer] = await ethers.getSigners();
  const houseWallet = process.env.HOUSE_WALLET || deployer.address;

  console.log("═══════════════════════════════════════════════════");
  console.log("  Reactivity Arena — Full Deployment");
  console.log("═══════════════════════════════════════════════════");
  console.log("  Deployer:", deployer.address);
  console.log("  House Wallet:", houseWallet);
  console.log("  Network:", (await ethers.provider.getNetwork()).name);
  console.log("  Chain ID:", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("  Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("═══════════════════════════════════════════════════\n");

  // 1. Deploy ReactiveBettingPool
  console.log("📦 [1/3] Deploying ReactiveBettingPool...");
  const BettingPool = await ethers.getContractFactory("ReactiveBettingPool");
  const bettingPool = await BettingPool.deploy(houseWallet, 700); // 7% fee
  await bettingPool.waitForDeployment();
  const bettingPoolAddr = await bettingPool.getAddress();
  console.log("   ✅ ReactiveBettingPool:", bettingPoolAddr);

  // 2. Deploy ReactiveSponsorship
  console.log("\n📦 [2/3] Deploying ReactiveSponsorship...");
  const Sponsorship = await ethers.getContractFactory("ReactiveSponsorship");
  const sponsorship = await Sponsorship.deploy(houseWallet);
  await sponsorship.waitForDeployment();
  const sponsorshipAddr = await sponsorship.getAddress();
  console.log("   ✅ ReactiveSponsorship:", sponsorshipAddr);

  // Link sponsorship to betting pool
  const linkTx = await sponsorship.setBettingPool(bettingPoolAddr);
  await linkTx.wait();
  console.log("   🔗 Linked to BettingPool");

  // 3. Deploy ReactiveMatchTimer
  console.log("\n📦 [3/3] Deploying ReactiveMatchTimer...");
  const MatchTimer = await ethers.getContractFactory("ReactiveMatchTimer");
  const matchTimer = await MatchTimer.deploy(bettingPoolAddr);
  await matchTimer.waitForDeployment();
  const matchTimerAddr = await matchTimer.getAddress();
  console.log("   ✅ ReactiveMatchTimer:", matchTimerAddr);

  // Summary
  const addresses = {
    ReactiveBettingPool: bettingPoolAddr,
    ReactiveSponsorship: sponsorshipAddr,
    ReactiveMatchTimer: matchTimerAddr,
    deployer: deployer.address,
    houseWallet: houseWallet,
    network: "somniaTestnet",
    chainId: 50312,
    deployedAt: new Date().toISOString(),
  };

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  ✅ All contracts deployed successfully!");
  console.log("═══════════════════════════════════════════════════");
  console.log(JSON.stringify(addresses, null, 2));

  // Save addresses to file
  const outputPath = path.join(__dirname, "..", "deployed-addresses.json");
  fs.writeFileSync(outputPath, JSON.stringify(addresses, null, 2));
  console.log("\n📄 Addresses saved to:", outputPath);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
