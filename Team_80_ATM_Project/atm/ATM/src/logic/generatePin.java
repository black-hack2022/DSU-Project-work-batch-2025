/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package logic;

import java.util.Random;

/**
 *
 * @author Home
 */
public class generatePin {
    public int pin=0;
    Random r=new Random();
 public int getPin(){
     String s=""+r.nextInt(9)+r.nextInt(9)+r.nextInt(9)+r.nextInt(9);
    
     if(s.charAt(0)=='0')
     {
     pin=Integer.parseInt(s);
     pin+=1000;
     }
     else{
     pin=Integer.parseInt(s);
     
     }
     return pin;
 }
    
}
