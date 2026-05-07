columns = [
    'duration','protocol_type','service','flag','src_bytes','dst_bytes','land','wrong_fragment','urgent',
    'hot','num_failed_logins','logged_in','num_compromised','root_shell','su_attempted','num_root','num_file_creations',
    'num_shells','num_access_files','num_outbound_cmds','is_host_login','is_guest_login','count','srv_count',
    'serror_rate','srv_serror_rate','rerror_rate','srv_rerror_rate','same_srv_rate','diff_srv_rate','srv_diff_host_rate',
    'dst_host_count','dst_host_srv_count','dst_host_same_srv_rate','dst_host_diff_srv_rate','dst_host_same_src_port_rate',
    'dst_host_srv_diff_host_rate','dst_host_serror_rate','dst_host_srv_serror_rate','dst_host_rerror_rate','dst_host_srv_rerror_rate',
    'label','difficulty'
]


def apply_columns(df):
    """Assign column names to the dataframe and return it.

    Expects the dataframe to have 43 columns matching `columns`.
    """
    if df.shape[1] != len(columns):
        raise ValueError(f"DataFrame has {df.shape[1]} columns but expected {len(columns)}")
    df = df.copy()
    df.columns = columns
    return df


if __name__ == '__main__':
    # quick smoke test when run directly (requires df variable in global scope)
    try:
        print('No df defined for direct run; import this module and call apply_columns(df)')
    except Exception:
        pass