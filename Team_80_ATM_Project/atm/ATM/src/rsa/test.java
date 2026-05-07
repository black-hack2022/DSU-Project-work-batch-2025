/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package rsa;

import java.math.BigInteger;

/**
 *
 * @author Admin
 */
public class test {
    public test(){
    RSA r=new RSA();
   BigInteger[] ciphertext = r.encrypt( "Hello how are you?" ) ;
   String recoveredPlaintext = r.decrypt( ciphertext ,r.getD(),r.getN()) ;
        System.out.println("final:"+recoveredPlaintext);
    
    }
    public void tt(){
    
    String nhash;
	BigInteger[] ciphertext = null;
	BigInteger n = null;
	BigInteger d = null;
	String password="Java";
	System.out.println("Password (Input) : "+ password);
	RSA rsa = new RSA( 8 ) ;
		n=rsa.getN();
		d=rsa.getD();
		ciphertext = rsa.encrypt(password) ;



		StringBuffer bf = new StringBuffer();
		for( int i = 0 ; i < ciphertext.length ; i++ )
		{
			bf.append( ciphertext[i].toString( 16 ).toUpperCase() ) ;

			if( i != ciphertext.length - 1 )
				System.out.print( " " ) ;
		}


		String message=bf.toString();
		System.out.println();
		System.out.println("Encrypted Message : "+message);

		String dhash  =  rsa.decrypt( ciphertext ,d,n) ;
		System.out.println();
		System.out.println("Decrypted Message : "+dhash);
    }
    public static void main(String[] args) {
    // test t=new test();
     PwdEncryption p=new PwdEncryption();
    // p.tt("Hello how are you?");
     BigInteger[] emsg=p.enc("Hello how are you?");
        System.out.println(">>"+emsg);
     String dmsg=p.dec(emsg);
        System.out.println("<<>>"+dmsg);
     //t.tt();
    }
}
