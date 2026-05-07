/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package rsa;

/**
 *
 * @author Admin
 */
import java.math.*;

public class PwdEncryption{

public static void main(String args[]){

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
public void tt(String text){
    
    String nhash;
	BigInteger[] ciphertext = null;
	BigInteger n = null;
	BigInteger d = null;
	String password="Java";
	System.out.println("Password (Input) : "+ text);
	RSA rsa = new RSA( 8 ) ;
		n=rsa.getN();
		d=rsa.getD();
		ciphertext = rsa.encrypt(text) ;



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
public BigInteger[] enc(String msg){
String nhash;
	BigInteger[] ciphertext = null;
	BigInteger n = null;
	BigInteger d = null;
	String password="Java";
	System.out.println("Password (Input) : "+ msg);
	RSA rsa = new RSA( 8 ) ;
		n=rsa.getN();
		d=rsa.getD();
		ciphertext = rsa.encrypt(msg) ;



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
    System.out.println("----------------------------------------------------------------ciphertext::"+ciphertext);
		String dhash  =  rsa.decrypt( ciphertext ,d,n) ;
		System.out.println();
		System.out.println("Decrypted Message : "+dhash);
                return ciphertext;
}

public String dec(BigInteger[] msg){
    String nhash;
	BigInteger[] ciphertext = null;
	BigInteger n = null;
	BigInteger d = null;
	
	RSA rsa = new RSA( 8 ) ;
		n=rsa.getN();
		d=rsa.getD();
  
    System.out.println("--------------------------------------------------"+msg);
		String dhash  =  rsa.decrypt( msg ,d,n) ;
		System.out.println();
		System.out.println("Decrypted Message : "+dhash);
                return dhash;
}
}




