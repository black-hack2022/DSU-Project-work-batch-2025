package database;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public class DBQuery {
public Connection con=null;
public Statement st=null;
public ResultSet rs=null;
	
	public int insertData(String name,String lname,String mobile,String email,String num_acc,String acc1,String acc2,String acc3,String aadhar,String pin) throws ClassNotFoundException, SQLException{
		String utype="";
		con=DBConnection.getConnection();
		st=con.createStatement();
		String q="insert into addUser values('"+name+"','"+lname+"','"+mobile+"','"+email+"','"+num_acc+"','"+acc1+"','"+acc2+"','"+acc3+"','"+aadhar+"','"+pin+"')";
		int i=st.executeUpdate(q);
		return i;
	}

}
