import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { writeFileSync, readFileSync } from "fs";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log("====================");
  console.log("Network:", hre.network.name);
  console.log("Deploying contracts with account:", deployer);
  console.log("====================");

  // Deploy MyMintableToken
  console.log("====================");
  console.log("Deploy MyMintableToken Contract");
  console.log("====================");
  const tokenDeployment = await deploy("MyMintableToken", {
    contract: "MyMintableToken",
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: false,
  });

  // Read merkle tree data from files
  const merkleData = JSON.parse(readFileSync("scripts/merkle/merkle.json", "utf8"));
  const merkleRoot = merkleData.root;

  // Read recipients data for reference
  const recipientsData = merkleData.recipients || [];

  console.log("Merkle Root:", merkleRoot);
  console.log("Recipients count:", recipientsData.length);

  // Deploy AirdropWithAccessControl
  console.log("====================");
  console.log("Deploy AirdropWithAccessControl Contract");
  console.log("====================");
  const airdropDeployment = await deploy("AirdropWithAccessControl", {
    contract: "AirdropWithAccessControl",
    from: deployer,
    args: [tokenDeployment.address, merkleRoot],
    log: true,
    autoMine: true,
    skipIfAlreadyDeployed: false,
  });

  // Grant MINTER_ROLE to airdrop contract
  const tokenContract = await ethers.getContractAt("MyMintableToken", tokenDeployment.address);
  await tokenContract.grantMinterRole(airdropDeployment.address);
  console.log("Granted MINTER_ROLE to AirdropWithAccessControl contract");

  // No need to mint tokens beforehand - they will be minted when claimed
  console.log("Tokens will be minted when users claim");

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    tokenAddress: tokenDeployment.address,
    airdropAddress: airdropDeployment.address,
    merkleRoot,
    recipients: recipientsData,
    merkleTree: merkleData,
  };

  const deploymentFile = `deployments/${hre.network.name}/AirdropWithAccessControl.json`;
  writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  console.log(`Deployment info saved to ${deploymentFile}`);

  // Display contract addresses
  console.log("====================");
  console.log("Deployment Summary");
  console.log("====================");
  console.log("Token Address:", tokenDeployment.address);
  console.log("Airdrop Address:", airdropDeployment.address);
  console.log("Merkle Root:", merkleRoot);
  console.log("Recipients:", recipientsData.length);
};

func.tags = ["deploy"];
export default func;
