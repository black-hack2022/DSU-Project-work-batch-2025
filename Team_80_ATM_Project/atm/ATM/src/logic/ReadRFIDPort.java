package logic;

import java.util.Scanner;
import java.io.*;
import java.util.*;
import gnu.io.*; // for rxtxSerial library
import java.sql.SQLException;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.swing.JOptionPane;
 
public class ReadRFIDPort implements SerialPortEventListener {
          String status="";
   static CommPortIdentifier portId;
   static CommPortIdentifier saveportId;
   static Enumeration        portList;
   InputStream           inputStream;
   SerialPort           serialPort;
  public static String user="";
 
   public static void rfid(){ 
      
           System.out.println("11111111111111111");
       
 
      boolean           portFound = false;
      String           rfidPort;
    //  Scanner input = new Scanner (System.in);
      //System.out.println("Please enter the port here");
      
     // rfidPort = input.next();
      rfidPort="COM9";
      System.out.println("Set default port to "+ rfidPort);
      
		// parse ports and if the default port is found, initialized the reader
      portList = CommPortIdentifier.getPortIdentifiers();
      while (portList.hasMoreElements()) {
         portId = (CommPortIdentifier) portList.nextElement();
         if (portId.getPortType() == CommPortIdentifier.PORT_SERIAL) {
            if (portId.getName().equals(rfidPort)) {
               System.out.println("Found port: "+rfidPort);
               portFound = true;
               
               ReadRFIDPort reader = new ReadRFIDPort();
            } 
         } 
         
      } 
      if (!portFound) {
         System.out.println("port " + rfidPort + "not found.");
      } 
  // return status;   
   } 
 
   public ReadRFIDPort() {
       /* System.out.println("11111111111111111");
       this.user=user;
 
      boolean           portFound = false;
      String           rfidPort;
    //  Scanner input = new Scanner (System.in);
      System.out.println("Please enter the port here");
      
     // rfidPort = input.next();
      rfidPort="COM9";
      System.out.println("Set default port to "+ rfidPort);
      
		// parse ports and if the default port is found, initialized the reader
      portList = CommPortIdentifier.getPortIdentifiers();
      while (portList.hasMoreElements()) {
         portId = (CommPortIdentifier) portList.nextElement();
         if (portId.getPortType() == CommPortIdentifier.PORT_SERIAL) {
            if (portId.getName().equals(rfidPort)) {
               System.out.println("Found port: "+rfidPort);
               portFound = true;
               
               ReadRFIDPort reader = new ReadRFIDPort();
            } 
         } 
         
      } 
      if (!portFound) {
         System.out.println("port " + rfidPort + "not found.");
      } */
      // initalize serial port
      try {
         serialPort = (SerialPort) portId.open("SimpleReadApp", 2000);
      } catch (PortInUseException e) {}
   
      try {
         inputStream = serialPort.getInputStream();
      } catch (IOException e) {}
   
      try {
         serialPort.addEventListener(this);
      } catch (TooManyListenersException e) {}
      
      // activate the DATA_AVAILABLE notifier
      serialPort.notifyOnDataAvailable(true);
   
      try {
         // set port parameters
         serialPort.setSerialPortParams(9600, SerialPort.DATABITS_8, 
                     SerialPort.STOPBITS_1, 
                     SerialPort.PARITY_NONE);
      } catch (UnsupportedCommOperationException e) {}
      
 
      
   }
 
    public void serialEvent(SerialPortEvent event) {
        String  result="";
      switch (event.getEventType()) {
      case SerialPortEvent.BI:
      case SerialPortEvent.OE:
      case SerialPortEvent.FE:
      case SerialPortEvent.PE:
      case SerialPortEvent.CD:
      case SerialPortEvent.CTS:
      case SerialPortEvent.DSR:
      case SerialPortEvent.RI:
      case SerialPortEvent.OUTPUT_BUFFER_EMPTY:
         break;
      case SerialPortEvent.DATA_AVAILABLE:
         // we get here if data has been received
          String res="";
              int numBytes=0;
              char ch;
         try {
            // read data
            while (inputStream.available() > 0) {
               // numBytes = inputStream.read(readBuffer);
             numBytes=inputStream.read();
             //   System.out.println("0000>"+numBytes);
              ch=(char)numBytes;
               
               System.out.println("111>"+ch);
            res+=ch;
            
               Thread.sleep(500);
               //Thread.sleep(5000);
            } inputStream.close();
            // print data
            System.out.println("??????????"+res);

              System.out.println(result + "      ");
               DBQuery d=new DBQuery();
               System.out.println("////"+user);
               res=res.substring(0,8);
               System.out.println("length"+res.length());
               status=d.rfidCheck(user,res);
               System.out.println("STATUS:>"+status);
               if(status.equals("OK"))
               {
               JOptionPane.showMessageDialog(null,"Matching");
                //new fingerReader(user).setVisible(true);
               }
               else{
               JOptionPane.showMessageDialog(null,"Not Matching");
               
               }
            
         } catch (InterruptedException ex) {
            Logger.getLogger(ReadRFIDPort.class.getName()).log(Level.SEVERE, null, ex);
        } catch (ClassNotFoundException ex) {
            Logger.getLogger(ReadRFIDPort.class.getName()).log(Level.SEVERE, null, ex);
        } catch (SQLException ex) {
            Logger.getLogger(ReadRFIDPort.class.getName()).log(Level.SEVERE, null, ex);
        } catch (IOException e) {}
   
         break;
      }
     
   } 
 
}