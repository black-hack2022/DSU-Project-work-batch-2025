/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package logic;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 *
 * @author User
 */
public class DBConnection {
    Connection con;
    public Connection getConnection() throws ClassNotFoundException, SQLException{
    Class.forName("com.mysql.jdbc.Driver");
    con=DriverManager.getConnection("jdbc:mysql://localhost:3307/atm","root","root");
    return con;
    }
    
}
