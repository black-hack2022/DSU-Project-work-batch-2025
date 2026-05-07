/*
MySQL Data Transfer
Source Host: localhost
Source Database: atm
Target Host: localhost
Target Database: atm
Date: 5/23/2016 2:32:10 PM
*/

SET FOREIGN_KEY_CHECKS=0;
-- ----------------------------
-- Table structure for adduser
-- ----------------------------
DROP TABLE IF EXISTS `adduser`;
CREATE TABLE `adduser` (
  `name` varchar(50) DEFAULT NULL,
  `lname` varchar(50) DEFAULT NULL,
  `mobile` varchar(50) DEFAULT NULL,
  `email` varchar(50) DEFAULT NULL,
  `num_acc` varchar(50) DEFAULT NULL,
  `acc1` varchar(50) DEFAULT NULL,
  `acc2` varchar(50) DEFAULT NULL,
  `acc3` varchar(50) DEFAULT NULL,
  `rfid` varchar(50) DEFAULT NULL,
  `path` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- ----------------------------
-- Table structure for balance
-- ----------------------------
DROP TABLE IF EXISTS `balance`;
CREATE TABLE `balance` (
  `username` varchar(20) DEFAULT NULL,
  `acNo` int(10) NOT NULL DEFAULT '0',
  `balance` int(10) DEFAULT NULL,
  PRIMARY KEY (`acNo`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- ----------------------------
-- Table structure for login
-- ----------------------------
DROP TABLE IF EXISTS `login`;
CREATE TABLE `login` (
  `acNo` varchar(20) NOT NULL,
  `password` varchar(8) NOT NULL,
  `bankname` int(10) NOT NULL,
  `utype` varchar(6) NOT NULL,
  PRIMARY KEY (`bankname`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- ----------------------------
-- Table structure for transaction
-- ----------------------------
DROP TABLE IF EXISTS `transaction`;
CREATE TABLE `transaction` (
  `username` varchar(30) NOT NULL,
  `date` varchar(20) NOT NULL,
  `t_type` varchar(30) NOT NULL,
  `flag` int(20) NOT NULL,
  `cash` bigint(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- ----------------------------
-- Table structure for user_details
-- ----------------------------
DROP TABLE IF EXISTS `user_details`;
CREATE TABLE `user_details` (
  `fname` varchar(20) NOT NULL,
  `lname` varchar(20) NOT NULL,
  `bankname` varchar(20) NOT NULL,
  `acNo` varchar(20) NOT NULL,
  `dob` varchar(40) NOT NULL,
  `sex` varchar(8) NOT NULL,
  `add1` varchar(60) NOT NULL,
  `city` varchar(20) NOT NULL,
  `pin` int(10) NOT NULL,
  `mobile` varchar(10) NOT NULL,
  `email` varchar(40) NOT NULL,
  PRIMARY KEY (`acNo`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

-- ----------------------------
-- Records 
-- ----------------------------
INSERT INTO `adduser` VALUES ('kaushal', 'singh', '8749064048', 'kaushal.singh029@gmail.com', '3', '2345678901', '9856432176', '3456876542', '7654320980', 'C:UserskaushalDesktopdownload.jpg');
INSERT INTO `adduser` VALUES ('kaushal', 'singh', '8749064048', 'kaushal.singh029@gmail.com', '3', '2345678901', '9856432176', '3456876542', '7654320980', 'C:UserskaushalDesktopdownload.jpg');
INSERT INTO `adduser` VALUES ('bharat', 'bhushan', '6787654321', 'bharat@gmail.com', '2', '8765435698', '3456543212', '', '76543234567', 'C:UserskaushalDesktopdownload.jpg');
INSERT INTO `adduser` VALUES ('priya', 'narayan', '7795192677', 'chandupriya27@gmail.com', '3', '100000002', '100000003', '100000004', '0010220052', 'C:UserskaushalDesktopxnew14.png');
INSERT INTO `adduser` VALUES ('priya', 'narayan', '7795192677', 'chandupriya27@gmail.com', '3', '1111111112', '1111111113', '1111111114', '0010220052', 'D:abc\reconfacesphi14.png');
INSERT INTO `adduser` VALUES ('priya', 'narayan', '7795192677', 'chandupriya27@gmail.com', '3', '1111111112', '1111111113', '1111111114', '0010220052', 'D:abc\reconfacesphi19.png');
INSERT INTO `adduser` VALUES ('priya', 'narayan', '7795192677', 'chandupriya27@gmail.com', '3', '1234567899', '1234567898', '1234567897', '0010220052', 'D:abc\reconfacesphi14.png');
INSERT INTO `adduser` VALUES ('priya', 'narayan', '7795192677', 'chandupriya27@gmail.com', '3', '1234567899', '1234567898', '1234567897', '0010220052', 'D:abc\reconfacesphi19.png');
INSERT INTO `balance` VALUES ('sumit', '1000100010', '100000');
INSERT INTO `login` VALUES ('sp', '123456', '1', 'sp');
INSERT INTO `login` VALUES ('reeth', 'facebook', '1000000001', 'user');
INSERT INTO `login` VALUES ('sumit', 'Facebook', '1000100010', 'user');
INSERT INTO `login` VALUES ('admin', '123456', '1010101000', 'admin');
INSERT INTO `user_details` VALUES ('reeth', 'harish', 'reeth', '1000000001', '16-Aug--1991', 'Female', 'kormangala', 'banglore', '45600', '8147559372', 'reetg@gmail.com');
INSERT INTO `user_details` VALUES ('sumit', 'saha', 'sumit', '1000100010', '18-Jul--1985', 'Male', 'jayanagar', 'bangalore', '560041', '9886832434', 'sumit_saha07@yahoo.com');
