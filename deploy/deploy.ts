import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { writeFileSync, readFileSync } from "fs";
import { ethers } from "hardhat";
import { MyMintableToken__factory } from "../typechain/factories/contracts";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("🚀 Deploying on", hre.network.name);
  console.log("Deployer:", deployer);

  // Deploy MyMintableToken
  const tokenDeployment = await deploy("MyMintableToken", {
    contract: "MyMintableToken",
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: true,
  });

  // Read merkle data
  const merkleData = JSON.parse(readFileSync("scripts/merkle/merkle.json", "utf8"));
  const merkleRoot = merkleData.root;
  const recipientsData = merkleData.recipients || [];

  console.log("Merkle root:", merkleRoot);
  console.log("Recipients:", recipientsData.length);

  // Deploy Airdrop (Upgradeable)

  // Deploy proxy for upgradeable contract
  const airdropDeployment = await deploy("Airdrop", {
    proxy: {
      proxyContract: "UUPS",
      execute: {
        init: {
          methodName: "initialize",
          args: [tokenDeployment.address, merkleRoot, deployer],
        },
      },
      upgradeFunction: {
        methodName: "upgradeToAndCall",
        upgradeArgs: ["{implementation}", "{data}"],
      },
    },
    contract: "Airdrop",
    from: deployer,
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: true,
  });

  // Grant MINTER_ROLE to airdrop
  const [signer] = await ethers.getSigners();
  const tokenContract = MyMintableToken__factory.connect(tokenDeployment.address, signer);
  const MINTER_ROLE = await tokenContract.MINTER_ROLE();
  const hasRole = await tokenContract.hasRole(MINTER_ROLE, airdropDeployment.address);

  if (!hasRole) {
    await tokenContract.grantRole(MINTER_ROLE, airdropDeployment.address);
    console.log("✅ Granted MINTER_ROLE");
  }

  console.log("\n✅ Deployed successfully!");
  console.log("Token:", tokenDeployment.address);
  console.log("Airdrop:", airdropDeployment.address);
};

func.tags = ["deploy"];
export default func;
